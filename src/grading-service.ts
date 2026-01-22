// AI-powered essay grading service
import type { GradingRequest, GradingResult, CriterionScore } from './types';

/**
 * Generates a comprehensive grading prompt based on the CoGrader rubric
 */
function generateGradingPrompt(request: GradingRequest): string {
  const rubricTable = request.rubric_criteria
    .map((c, i) => `${i + 1}. ${c.criterion_name}\n   ${c.criterion_description}`)
    .join('\n\n');

  return `You are an expert in Automated Essay Grading (AEG) powered by cutting-edge Large Language Models (LLMs). Your mission is to grade student essays according to a given rubric and provide comprehensive, detailed feedback that promotes learning and growth.

Your grading objectives are as follows:
1. Consistent Grading (AES): Achieve Substantial agreement (QWK 0.61 or higher) with human markers as the top priority.
2. In-depth Feedback (AWE): Feedback must be timely, specific, detailed, and supportive.

---

INPUT PARAMETERS:

A. Assignment Prompt:
${request.assignment_prompt}

Grade Level: ${request.grade_level}

B. Rubric Criteria:
${rubricTable}

C. Student Essay:
${request.essay_text}

---

OUTPUT REQUIREMENTS:

Please provide your evaluation in the following JSON format (must be valid JSON):

{
  "total_score": [number out of 10],
  "summary_evaluation": "[Brief summary of overall quality and main factors affecting the score]",
  "criterion_scores": [
    {
      "criterion_name": "[Exact criterion name from rubric]",
      "score": [1-4],
      "strengths": "[Specific positive elements with examples from the essay]",
      "areas_for_improvement": "[Specific weaknesses with examples from the essay]"
    }
  ],
  "overall_comment": "[Comprehensive opinion on how well the essay met the assignment prompt]",
  "revision_suggestions": "[At least 3 specific examples of errors found in the essay with detailed recommendations for revision. Include specific quotes from the essay and explain how to fix each issue.]",
  "next_steps_advice": "[Practical strategies for overall writing improvement, considering student's proficiency level]"
}

Important:
- Assign a score from 1 to 4 for each criterion
- Calculate total_score out of 10 based on the criterion scores
- Provide specific examples from the essay in your feedback
- Be constructive and supportive in your criticism
- Focus on actionable improvements
- Return ONLY valid JSON, no additional text`;
}

/**
 * Simulates AI grading using a structured analysis approach
 * In production, this would call an actual LLM API (OpenAI, Anthropic, etc.)
 */
export async function gradeEssay(request: GradingRequest): Promise<GradingResult> {
  const prompt = generateGradingPrompt(request);
  
  // For demo purposes, we'll create a structured analysis
  // In production, replace this with actual LLM API call:
  // const response = await fetch('https://api.openai.com/v1/chat/completions', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model: 'gpt-4',
  //     messages: [{ role: 'user', content: prompt }],
  //     temperature: 0.3,
  //   }),
  // });
  
  // Demo grading logic (replace with actual LLM response)
  const result = await simulateGrading(request);
  
  return result;
}

/**
 * Simulates grading for demonstration purposes
 * This provides a template for how the actual LLM response should be structured
 */
async function simulateGrading(request: GradingRequest): Promise<GradingResult> {
  // Analyze essay characteristics
  const wordCount = request.essay_text.trim().split(/\s+/).length;
  const paragraphCount = request.essay_text.trim().split(/\n\n+/).length;
  const sentenceCount = request.essay_text.trim().split(/[.!?]+/).length;
  
  // Simulate criterion scoring
  const criterion_scores: CriterionScore[] = request.rubric_criteria.map((criterion, index) => {
    // Vary scores based on essay characteristics
    let score = 3; // Default to "proficient"
    
    if (index === 0) { // Understanding and Analysis
      score = wordCount > 300 ? 3 : 2;
    } else if (index === 1) { // Use of Evidence
      score = paragraphCount >= 4 ? 3 : 2;
    } else if (index === 2) { // Accuracy of Citations
      const hasCitations = /documentary|source|according to/i.test(request.essay_text);
      score = hasCitations ? 3 : 2;
    } else if (index === 3) { // Grammar and Organization
      score = sentenceCount >= 10 ? 3 : 2;
    }
    
    return {
      criterion_name: criterion.criterion_name,
      score: score,
      max_score: criterion.max_score || 4,  // Include max_score from rubric
      strengths: generateStrengths(criterion.criterion_name, score, request.essay_text),
      areas_for_improvement: generateImprovements(criterion.criterion_name, score, request.essay_text)
    };
  });
  
  // Calculate total score using actual max_score from rubric criteria
  const totalPoints = criterion_scores.reduce((sum, c) => sum + c.score, 0);
  const maxPoints = request.rubric_criteria.reduce((sum, r) => sum + (r.max_score || 4), 0);
  const total_score = Math.round((totalPoints / maxPoints) * 100 * 10) / 10;
  
  return {
    total_score,
    summary_evaluation: `This essay demonstrates ${total_score >= 7.5 ? 'strong' : total_score >= 6 ? 'adequate' : 'developing'} understanding of the topic. The essay contains approximately ${wordCount} words and ${paragraphCount} paragraphs, showing ${total_score >= 7 ? 'good' : 'moderate'} organization and depth of analysis.`,
    criterion_scores,
    overall_comment: `The essay addresses the assignment prompt by discussing the major causes of World War II. ${total_score >= 7 ? 'The writer demonstrates a solid grasp of historical concepts and provides relevant examples.' : 'However, there is room for improvement in developing deeper analysis and providing more specific historical evidence.'} The organizational structure ${paragraphCount >= 5 ? 'effectively guides the reader through the argument' : 'could be strengthened with clearer paragraph transitions and topic sentences'}.`,
    revision_suggestions: `1. **Citation Enhancement**: Add more specific references to the required documentary source. For example, instead of general statements, cite specific scenes or experts featured in "Documentary 'World War II'" with timestamps or chapter references.\n\n2. **Historical Specificity**: Replace general phrases with concrete dates, names, and events. For instance, when discussing the Treaty of Versailles, mention specific articles (such as Article 231, the "War Guilt Clause") and their exact impacts on German reparations.\n\n3. **Analytical Depth**: Strengthen causal connections between events. Rather than simply listing causes, explain the mechanisms by which each factor led to war. For example, show how the economic provisions of the Treaty of Versailles created conditions that allowed extremist political movements to gain support.`,
    next_steps_advice: `To improve your analytical writing skills for ${request.grade_level} level:\n\n1. **Practice Evidence Integration**: Work on smoothly incorporating quotations and paraphrases from sources. Use signal phrases (e.g., "According to...", "As demonstrated in...") and always cite your sources accurately.\n\n2. **Develop Thesis-Driven Writing**: Ensure every paragraph connects back to your main argument. Ask yourself: "How does this evidence support my thesis?"\n\n3. **Enhance Vocabulary**: Build domain-specific vocabulary related to your topic. For historical writing, learn terms like "causation," "historical context," "primary source," and "historiography."\n\n4. **Peer Review**: Exchange essays with classmates and practice giving and receiving constructive feedback using the rubric criteria.\n\n5. **Revision Strategy**: After receiving feedback, create a revision plan that addresses specific weaknesses. Focus on one criterion at a time rather than trying to fix everything at once.`
  };
}

function generateStrengths(criterionName: string, score: number, essayText: string): string {
  const excerptLength = 100;
  const excerpt = essayText.substring(0, excerptLength) + (essayText.length > excerptLength ? '...' : '');
  
  if (score >= 3) {
    return `The essay demonstrates ${score === 4 ? 'exceptional' : 'solid'} performance in "${criterionName}". The writing shows clear understanding and appropriate development of ideas. The opening "${excerpt}" establishes a ${score === 4 ? 'compelling' : 'clear'} direction for the analysis.`;
  } else {
    return `The essay shows emerging competence in "${criterionName}". There are foundational elements in place that can be built upon with further development.`;
  }
}

function generateImprovements(criterionName: string, score: number, essayText: string): string {
  if (score === 4) {
    return `While performance is strong, consider adding even more nuanced analysis and exploring counterarguments to achieve exceptional depth in "${criterionName}".`;
  } else if (score === 3) {
    return `To elevate performance in "${criterionName}", focus on providing more specific examples and deeper analysis. Expand on the connections between your evidence and main arguments.`;
  } else if (score === 2) {
    return `The essay would benefit from significant enhancement in "${criterionName}". Work on developing more detailed explanations, providing specific evidence, and strengthening the logical connections between ideas.`;
  } else {
    return `Substantial improvement is needed in "${criterionName}". Focus on understanding the basic requirements of this criterion, provide relevant examples, and ensure all components of the rubric are adequately addressed.`;
  }
}

// Export the prompt generator for testing/debugging purposes
export { generateGradingPrompt };
