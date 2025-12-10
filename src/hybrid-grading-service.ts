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
  // Support both ANTHROPIC_API_KEY and CLAUDE_API_KEY for flexibility
  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY,
  });

  return { openai, anthropic };
}

/**
 * Phase 1: GPT-4o generates rubric-based scores
 */
function generateScoringPrompt(request: GradingRequest): string {
  // Format rubric as detailed JSON
  const rubricJson = JSON.stringify({
    total_score: request.rubric_criteria.length === 3 ? 100 : 100, // Adjust based on rubric
    criteria: request.rubric_criteria.map(c => ({
      category: c.criterion_name,
      description: c.criterion_description
    }))
  }, null, 2);

  return `당신은 ${request.grade_level} 학생의 논술을 평가하는 전문 채점자입니다.

역할 정의:
- 학년: ${request.grade_level}
- 평가 목표: 루브릭 기준에 따라 정확하고 일관된 점수 부여

목표(Objective):
학생의 글을 아래 [채점 기준표(Rubric)]에 따라 분석하고, 각 기준별 점수와 총점을 제공합니다.

입력 데이터:

A. 에세이 주제:
${request.assignment_prompt}

B. 에세이 내용:
${request.essay_text}

C. 채점 기준표 (Rubric) - JSON 형식:
${rubricJson}

채점 지침:
1. 각 기준에 대해 1-4점 척도로 평가:
   - 4점: 기대 이상, 탁월한 수준
   - 3점: 기대 충족, 능숙한 수준  
   - 2점: 기대 부분 충족, 발전 중인 수준
   - 1점: 기대 미충족, 상당한 개선 필요

2. ${request.grade_level} 학생의 발달 단계를 고려하여 평가
3. 루브릭 기준에만 근거하여 객관적으로 평가
4. 총점은 각 기준 점수의 합계 (기준 개수 × 4점이 만점)

출력 형식 (반드시 JSON만 반환):
{
  "total_score": [모든 기준 점수의 합계],
  "criterion_scores": [
    {
      "criterion_name": "[정확한 기준명]",
      "score": [1-4점],
      "brief_rationale": "[이 점수를 부여한 이유 1-2문장]"
    }
  ]
}

중요:
- 일관성 있고 객관적인 채점
- 루브릭 기준에만 근거
- 총점은 각 기준 점수의 합계 (예: 4개 기준 = 최대 16점)
- 유효한 JSON만 반환, 추가 텍스트 없음`;
}

/**
 * Get grade-level specific tone and approach
 */
function getGradeLevelContext(gradeLevel: string): { 
  role: string; 
  tone: string; 
  feedbackStructure: string;
} {
  const level = gradeLevel.toLowerCase();
  
  if (level.includes('초등') || level.includes('elementary')) {
    return {
      role: '초등학생을 위한 글쓰기 멘토 선생님',
      tone: '친근하고 부드러운 말투로 칭찬을 많이 하며, 어려운 용어 대신 쉬운 설명을 사용합니다.',
      feedbackStructure: '샌드위치 피드백: 칭찬 → 개선점 제시 → 구체적 예시 → 격려'
    };
  } else if (level.includes('중학') || level.includes('middle')) {
    return {
      role: '중학생을 위한 글쓰기 멘토 선생님',
      tone: '존중하면서도 친근한 말투로 논리적 사고를 격려하며, 구체적인 예시와 함께 설명합니다.',
      feedbackStructure: '샌드위치 피드백: 강점 인정 → 논리적 개선점 → 실천 가능한 조언 → 격려'
    };
  } else if (level.includes('고등') || level.includes('high')) {
    return {
      role: '고등학생을 위한 글쓰기 멘토 선생님',
      tone: '존중하고 격식 있는 말투로 비판적 사고와 깊이 있는 분석을 독려하며, 학술적 글쓰기 수준을 높입니다.',
      feedbackStructure: '샌드위치 피드백: 통찰력 인정 → 분석적 개선점 → 구체적 전략 → 학술적 성장 격려'
    };
  }
  
  // Default to middle school
  return {
    role: '학생을 위한 글쓰기 멘토 선생님',
    tone: '존중하면서도 친근한 말투로 논리적 사고를 격려합니다.',
    feedbackStructure: '샌드위치 피드백: 칭찬 → 개선점 → 구체적 예시 → 격려'
  };
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
  
  const gradeContext = getGradeLevelContext(request.grade_level);
  
  // Format rubric as JSON for structured reference
  const rubricJson = JSON.stringify({
    rubric_criteria: request.rubric_criteria.map(c => ({
      criterion_name: c.criterion_name,
      description: c.criterion_description
    }))
  }, null, 2);

  return `당신은 "${gradeContext.role}"입니다.

역할 정의:
- 학년: ${request.grade_level}
- 말투: ${gradeContext.tone}
- 피드백 구조: ${gradeContext.feedbackStructure}

목표(Objective):
학생의 글을 아래 [채점 기준표(Rubric)]에 따라 분석하고, 점수와 함께 학생이 이해하기 쉬운 피드백을 제공합니다.

피드백 가이드라인:
1. 톤(Tone):
   - ${gradeContext.tone}
   - 절대 비난하지 않고, 학생이 노력한 부분을 먼저 인정
   - 기계적이지 않고 따뜻하며 인간적인 말투

2. 구조(Structure) - 샌드위치 피드백:
   ${gradeContext.feedbackStructure}

3. 금지 요소:
   - "이 글은 형편없다", "전혀 이해하지 못했다" 등 직접적 비난
   - 기계적이고 무미건조한 말투
   - 막연한 조언 ("더 열심히 하세요" 대신 "서론에 주장을 한 문장으로 명확히 적어보세요")

입력 데이터:

A. 에세이 주제:
${request.assignment_prompt}

B. 에세이 내용:
${request.essay_text}

C. 채점 기준표 (Rubric):
${rubricJson}

D. 이미 부여된 점수 (다른 AI가 평가):
총점: ${scoringResult.total_score}/10
${scoresTable}

당신은 위 점수를 바탕으로 학생에게 따뜻하고 구체적이며 실천 가능한 피드백을 작성해야 합니다.

출력 형식 (반드시 JSON):
{
  "total_score": ${scoringResult.total_score},
  "grade_level_analysis": "${request.grade_level} 학생에게 적합한 평가 및 격려 메시지",
  "feedback_content": {
    "warm_opening": "학생의 노력을 인정하고 격려하는 따뜻한 시작 (2-3문장)",
    "strength_points": [
      "구체적인 강점 1 (에세이에서 인용)",
      "구체적인 강점 2 (에세이에서 인용)"
    ],
    "improvement_areas": [
      {
        "criterion": "개선이 필요한 기준명",
        "specific_issue": "구체적으로 어떤 부분이 부족한지 (에세이 인용)",
        "actionable_advice": "학생이 바로 실천할 수 있는 구체적 조언"
      }
    ],
    "closing_encouragement": "다음 글쓰기를 응원하는 따뜻한 마무리 (2-3문장)"
  }
}

중요: 반드시 유효한 JSON만 반환하세요. 추가 텍스트 없이 JSON만 출력하세요.`;
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
    if (!env.OPENAI_API_KEY || (!env.ANTHROPIC_API_KEY && !env.CLAUDE_API_KEY)) {
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
          content: '당신은 학생 논술을 루브릭 기준에 따라 정확하고 일관되게 채점하는 전문 평가자입니다. 항상 유효한 JSON 형식으로만 응답하세요.'
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
      model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 (latest)
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
    // Support both new and old feedback formats
    const feedbackContent = feedbackResult.feedback_content || feedbackResult;
    
    // Build criterion scores with detailed feedback
    const criterion_scores: CriterionScore[] = scoringResult.criterion_scores.map((score: any) => {
      // Try to find matching improvement area from new format
      let improvementFeedback = '';
      let strengthsFeedback = score.brief_rationale;
      
      if (feedbackContent.improvement_areas && Array.isArray(feedbackContent.improvement_areas)) {
        const improvement = feedbackContent.improvement_areas.find(
          (area: any) => area.criterion === score.criterion_name || 
                        area.criterion_name === score.criterion_name
        );
        if (improvement) {
          improvementFeedback = improvement.actionable_advice || improvement.specific_issue || '';
        }
      }
      
      // Fallback to old format
      if (!improvementFeedback && feedbackResult.criterion_feedback) {
        const oldFeedback = feedbackResult.criterion_feedback.find(
          (f: any) => f.criterion_name === score.criterion_name
        );
        if (oldFeedback) {
          strengthsFeedback = oldFeedback.strengths || score.brief_rationale;
          improvementFeedback = oldFeedback.areas_for_improvement || '';
        }
      }
      
      return {
        criterion_name: score.criterion_name,
        score: score.score,
        strengths: strengthsFeedback,
        areas_for_improvement: improvementFeedback || '이 기준을 더욱 발전시켜 보세요.'
      };
    });

    // Build summary evaluation
    const summaryEvaluation = feedbackResult.grade_level_analysis || 
                              feedbackContent.warm_opening || 
                              feedbackResult.summary_evaluation || 
                              '좋은 시도입니다!';
    
    // Build overall comment from strength points and closing
    let overallComment = feedbackResult.overall_comment || '';
    if (!overallComment && feedbackContent.strength_points) {
      const strengthsText = Array.isArray(feedbackContent.strength_points) 
        ? feedbackContent.strength_points.join(' ') 
        : feedbackContent.strength_points;
      const closingText = feedbackContent.closing_encouragement || '';
      overallComment = `${strengthsText}\n\n${closingText}`;
    }
    
    // Build revision suggestions
    let revisionSuggestions = feedbackResult.revision_suggestions || '';
    if (!revisionSuggestions && feedbackContent.improvement_areas) {
      revisionSuggestions = Array.isArray(feedbackContent.improvement_areas)
        ? feedbackContent.improvement_areas.map((area: any, idx: number) => 
            `${idx + 1}. ${area.criterion || area.criterion_name}: ${area.actionable_advice || area.specific_issue}`
          ).join('\n')
        : '';
    }

    const result: GradingResult = {
      total_score: scoringResult.total_score,
      summary_evaluation: summaryEvaluation,
      criterion_scores: criterion_scores,
      overall_comment: overallComment || '계속해서 글쓰기 실력을 발전시켜 나가세요.',
      revision_suggestions: revisionSuggestions || '작성한 글을 다시 읽어보며 개선점을 찾아보세요.',
      next_steps_advice: feedbackResult.next_steps_advice || feedbackContent.closing_encouragement || '다음번에는 더 좋은 글을 작성할 수 있을 거예요!'
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
  
  // Calculate total score (sum of all criterion scores)
  const total_score = criterion_scores.reduce((sum, c) => sum + c.score, 0);
  const maxPoints = criterion_scores.length * 4;
  
  // Calculate percentage for evaluation
  const percentage = (total_score / maxPoints) * 100;
  
  return {
    total_score,
    summary_evaluation: `[시뮬레이션 모드] 이 에세이는 ${percentage >= 75 ? '강한' : percentage >= 60 ? '적절한' : '발전 중인'} 주제 이해를 보여줍니다. 약 ${wordCount}단어와 ${paragraphCount}개 문단으로 구성되어 있으며, ${percentage >= 70 ? '좋은' : '보통의'} 조직력과 분석 깊이를 보여줍니다.`,
    criterion_scores,
    overall_comment: `[시뮬레이션 모드] 이 에세이는 과제 주제를 다루고 있습니다. ${percentage >= 70 ? '작성자는 개념에 대한 탄탄한 이해를 보여주며 관련 예시를 제공합니다.' : '그러나 더 깊은 분석과 구체적인 증거 제공에서 개선의 여지가 있습니다.'} 조직 구조는 ${paragraphCount >= 5 ? '효과적으로 논증을 안내합니다' : '더 명확한 문단 전환과 주제문으로 강화될 수 있습니다'}.`,
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
