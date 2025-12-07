// Hybrid AI-powered essay grading service
// GPT-4o for scoring, Claude 3.5 Sonnet for feedback generation
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { GradingRequest, GradingResult, CriterionScore } from './types';

/**
 * Initialize AI clients with configuration
 */
function initializeClients(env: any) {
  // OpenAI client for scoring (GPT-4o)
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });

  // Anthropic client for feedback generation (Claude 3.5 Sonnet)
  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  return { openai, anthropic };
}

/**
 * Phase 1: GPT-4o generates rubric-based scores
 */
function generateScoringPrompt(request: GradingRequest): string {
  const rubricTable = request.rubric_criteria
    .map((c, i) => `${i + 1}. ${c.criterion_name}\n   ${c.criterion_description}`)
    .join('\n\n');

  return `You are an expert essay grader focused on ACCURATE and CONSISTENT scoring based on rubric criteria.

Your task: Assign scores (1-4) for each criterion based ONLY on the rubric and essay quality.

INPUT PARAMETERS:

A. Assignment Prompt:
${request.assignment_prompt}

Grade Level: ${request.grade_level}

B. Rubric Criteria (Score each from 1-4):
${rubricTable}

C. Student Essay:
${request.essay_text}

SCORING SCALE:
- Score 4: Exceeds expectations, exceptional quality
- Score 3: Meets expectations, proficient quality
- Score 2: Partially meets expectations, developing quality
- Score 1: Does not meet expectations, needs significant improvement

OUTPUT REQUIREMENTS (JSON only):
{
  "total_score": [number out of 10],
  "criterion_scores": [
    {
      "criterion_name": "[Exact criterion name]",
      "score": [1-4],
      "brief_rationale": "[1-2 sentence explanation for this score]"
    }
  ]
}

Important:
- Be CONSISTENT and OBJECTIVE in scoring
- Base scores ONLY on rubric criteria
- Calculate total_score out of 10 proportionally
- Return ONLY valid JSON, no additional text`;
}

/**
 * Phase 2: Claude 3.5 Sonnet generates detailed feedback
 */
function generateFeedbackPrompt(
  request: GradingRequest,
  scoringResult: any
): string {
  const scoresTable = scoringResult.criterion_scores
    .map((c: any) => `- ${c.criterion_name}: ${c.score}/4 (${c.brief_rationale})`)
    .join('\n');

  return `You are an expert writing coach focused on providing ENCOURAGING, SPECIFIC, and ACTIONABLE feedback to help students improve their writing.

CONTEXT:

Assignment Prompt:
${request.assignment_prompt}

Grade Level: ${request.grade_level}

Student Essay:
${request.essay_text}

SCORES ASSIGNED (by another AI):
Total Score: ${scoringResult.total_score}/10
${scoresTable}

YOUR TASK:

Based on the scores and essay, generate comprehensive feedback that:
1. Encourages the student with specific praise
2. Provides concrete examples from their essay
3. Offers actionable improvement suggestions
4. Maintains a supportive, growth-oriented tone

OUTPUT REQUIREMENTS (JSON only):
{
  "summary_evaluation": "[2-3 sentences summarizing overall quality and achievement]",
  "criterion_feedback": [
    {
      "criterion_name": "[Exact criterion name]",
      "strengths": "[Specific positive elements with examples from essay, 2-3 sentences]",
      "areas_for_improvement": "[Specific weaknesses with examples, 2-3 sentences]"
    }
  ],
  "overall_comment": "[3-4 sentences on how well essay met assignment prompt]",
  "revision_suggestions": "[At least 3 specific examples with quotes and detailed fix recommendations, formatted with bullet points]",
  "next_steps_advice": "[5 practical strategies for improvement, considering student's level]"
}

Important:
- Be ENCOURAGING and CONSTRUCTIVE
- Cite SPECIFIC examples from the essay
- Make suggestions ACTIONABLE and CLEAR
- Focus on GROWTH and LEARNING
- Return ONLY valid JSON, no additional text`;
}

/**
 * Main hybrid grading function
 */
export async function gradeEssayHybrid(
  request: GradingRequest,
  env: any
): Promise<GradingResult> {
  try {
    // Check if AI API keys are configured
    if (!env.OPENAI_API_KEY || !env.ANTHROPIC_API_KEY) {
      console.log('AI API keys not configured, falling back to simulation mode');
      return simulateGrading(request);
    }

    const { openai, anthropic } = initializeClients(env);

    // Phase 1: GPT-4o scores the essay
    console.log('[Hybrid AI] Phase 1: GPT-4o scoring...');
    const scoringPrompt = generateScoringPrompt(request);
    
    const scoringResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert essay grader focused on accurate, consistent scoring based on rubric criteria. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: scoringPrompt
        }
      ],
      temperature: 0.3, // Lower temperature for consistency
      response_format: { type: 'json_object' }
    });

    const scoringResultText = scoringResponse.choices[0].message.content || '{}';
    const scoringResult = JSON.parse(scoringResultText);
    console.log('[Hybrid AI] Phase 1 complete. Total score:', scoringResult.total_score);

    // Phase 2: Claude 3.5 Sonnet generates feedback
    console.log('[Hybrid AI] Phase 2: Claude 3.5 Sonnet feedback generation...');
    const feedbackPrompt = generateFeedbackPrompt(request, scoringResult);
    
    const feedbackResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.7, // Higher temperature for creative feedback
      messages: [
        {
          role: 'user',
          content: feedbackPrompt
        }
      ]
    });

    const feedbackText = feedbackResponse.content[0].type === 'text' 
      ? feedbackResponse.content[0].text 
      : '{}';
    
    // Extract JSON from Claude's response (it might include extra text)
    const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
    const feedbackResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(feedbackText);
    console.log('[Hybrid AI] Phase 2 complete');

    // Merge results: scores from GPT-4o, feedback from Claude
    const criterion_scores: CriterionScore[] = scoringResult.criterion_scores.map((score: any) => {
      const feedback = feedbackResult.criterion_feedback.find(
        (f: any) => f.criterion_name === score.criterion_name
      );
      
      return {
        criterion_name: score.criterion_name,
        score: score.score,
        strengths: feedback?.strengths || score.brief_rationale,
        areas_for_improvement: feedback?.areas_for_improvement || 'Continue developing this skill.'
      };
    });

    const result: GradingResult = {
      total_score: scoringResult.total_score,
      summary_evaluation: feedbackResult.summary_evaluation,
      criterion_scores: criterion_scores,
      overall_comment: feedbackResult.overall_comment,
      revision_suggestions: feedbackResult.revision_suggestions,
      next_steps_advice: feedbackResult.next_steps_advice
    };

    console.log('[Hybrid AI] Grading complete successfully');
    return result;

  } catch (error) {
    console.error('[Hybrid AI] Error during grading:', error);
    console.log('[Hybrid AI] Falling back to simulation mode');
    
    // Fallback to simulation if API calls fail
    return simulateGrading(request);
  }
}

/**
 * Fallback simulation for when AI APIs are not available
 */
async function simulateGrading(request: GradingRequest): Promise<GradingResult> {
  console.log('[Simulation] Using fallback grading logic');
  
  // Analyze essay characteristics
  const wordCount = request.essay_text.trim().split(/\s+/).length;
  const paragraphCount = request.essay_text.trim().split(/\n\n+/).length;
  const sentenceCount = request.essay_text.trim().split(/[.!?]+/).length;
  
  // Simulate criterion scoring
  const criterion_scores: CriterionScore[] = request.rubric_criteria.map((criterion, index) => {
    let score = 3; // Default to "proficient"
    
    if (index === 0) {
      score = wordCount > 300 ? 3 : 2;
    } else if (index === 1) {
      score = paragraphCount >= 4 ? 3 : 2;
    } else if (index === 2) {
      const hasCitations = /documentary|source|according to/i.test(request.essay_text);
      score = hasCitations ? 3 : 2;
    } else if (index === 3) {
      score = sentenceCount >= 10 ? 3 : 2;
    }
    
    return {
      criterion_name: criterion.criterion_name,
      score: score,
      strengths: generateStrengths(criterion.criterion_name, score, request.essay_text),
      areas_for_improvement: generateImprovements(criterion.criterion_name, score, request.essay_text)
    };
  });
  
  // Calculate total score
  const totalPoints = criterion_scores.reduce((sum, c) => sum + c.score, 0);
  const maxPoints = criterion_scores.length * 4;
  const total_score = Math.round((totalPoints / maxPoints) * 10 * 10) / 10;
  
  return {
    total_score,
    summary_evaluation: `[시뮬레이션 모드] 이 에세이는 ${total_score >= 7.5 ? '강한' : total_score >= 6 ? '적절한' : '발전 중인'} 주제 이해를 보여줍니다. 약 ${wordCount}단어와 ${paragraphCount}개 문단으로 구성되어 있으며, ${total_score >= 7 ? '좋은' : '보통의'} 조직력과 분석 깊이를 보여줍니다.`,
    criterion_scores,
    overall_comment: `[시뮬레이션 모드] 이 에세이는 과제 주제를 다루고 있습니다. ${total_score >= 7 ? '작성자는 개념에 대한 탄탄한 이해를 보여주며 관련 예시를 제공합니다.' : '그러나 더 깊은 분석과 구체적인 증거 제공에서 개선의 여지가 있습니다.'} 조직 구조는 ${paragraphCount >= 5 ? '효과적으로 논증을 안내합니다' : '더 명확한 문단 전환과 주제문으로 강화될 수 있습니다'}.`,
    revision_suggestions: `[시뮬레이션 모드]\n1. **인용 강화**: 더 구체적인 출처 참조를 추가하세요.\n2. **역사적 구체성**: 일반적인 표현을 구체적인 날짜, 이름, 사건으로 대체하세요.\n3. **분석 깊이**: 사건 간의 인과 관계를 강화하세요.`,
    next_steps_advice: `[시뮬레이션 모드] ${request.grade_level} 수준의 분석적 글쓰기 능력을 향상시키기 위해:\n1. 증거 통합 연습\n2. 논제 중심 글쓰기 개발\n3. 어휘력 향상\n4. 동료 평가 참여\n5. 수정 전략 수립`
  };
}

function generateStrengths(criterionName: string, score: number, essayText: string): string {
  const excerptLength = 100;
  const excerpt = essayText.substring(0, excerptLength) + (essayText.length > excerptLength ? '...' : '');
  
  if (score >= 3) {
    return `"${criterionName}" 기준에서 ${score === 4 ? '탁월한' : '견고한'} 성과를 보여줍니다. 글은 명확한 이해와 적절한 아이디어 개발을 보여줍니다. 서두 "${excerpt}"는 분석을 위한 ${score === 4 ? '설득력 있는' : '명확한'} 방향을 제시합니다.`;
  } else {
    return `"${criterionName}" 기준에서 신흥 역량을 보여줍니다. 추가 개발로 구축할 수 있는 기초 요소가 있습니다.`;
  }
}

function generateImprovements(criterionName: string, score: number, essayText: string): string {
  if (score === 4) {
    return `성과가 강력하지만, "${criterionName}"에서 탁월한 깊이를 달성하기 위해 더 미묘한 분석과 반대 논증 탐구를 고려하세요.`;
  } else if (score === 3) {
    return `"${criterionName}"에서 성과를 높이려면 더 구체적인 예시 제공과 더 깊은 분석에 집중하세요. 증거와 주요 논증 간의 연결을 확장하세요.`;
  } else if (score === 2) {
    return `"${criterionName}"에서 상당한 개선이 도움이 될 것입니다. 더 상세한 설명 개발, 구체적인 증거 제공, 아이디어 간의 논리적 연결 강화에 노력하세요.`;
  } else {
    return `"${criterionName}"에서 실질적인 개선이 필요합니다. 이 기준의 기본 요구 사항을 이해하고, 관련 예시를 제공하며, 루브릭의 모든 구성 요소가 적절히 다루어지도록 하는 데 집중하세요.`;
  }
}

// Export for backward compatibility
export { generateScoringPrompt, generateFeedbackPrompt };
