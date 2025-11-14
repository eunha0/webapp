// Detailed Feedback Generation Service

interface CriterionFeedback {
  criterion_name: string
  score: number
  positive_feedback: string
  improvement_areas: string
  specific_suggestions: string
}

interface DetailedFeedbackResult {
  criterion_feedbacks: CriterionFeedback[]
  overall_summary: {
    total_score: number
    strengths: string
    weaknesses: string
    overall_comment: string
    improvement_priority: string
  }
}

interface FeedbackRequest {
  essay_text: string
  grade_level: string
  rubric_criteria: Array<{
    criterion_name: string
    criterion_description: string
  }>
  criterion_scores: Array<{
    criterion_name: string
    score: number
    strengths: string
    areas_for_improvement: string
  }>
  feedback_level?: 'detailed' | 'moderate' | 'brief'
  grading_strictness?: 'lenient' | 'moderate' | 'strict'
}

/**
 * Generate detailed feedback for each criterion with tone adjusted for grade level
 */
export async function generateDetailedFeedback(request: FeedbackRequest): Promise<DetailedFeedbackResult> {
  const { 
    essay_text, 
    grade_level, 
    rubric_criteria, 
    criterion_scores,
    feedback_level = 'detailed',
    grading_strictness = 'moderate'
  } = request
  
  // Determine tone based on grade level
  const tone = getGradeLevelTone(grade_level)
  
  // Generate feedback for each criterion
  const criterion_feedbacks: CriterionFeedback[] = criterion_scores.map(score => {
    const criterion = rubric_criteria.find(r => r.criterion_name === score.criterion_name)
    
    return {
      criterion_name: score.criterion_name,
      score: score.score,
      positive_feedback: generatePositiveFeedback(score, criterion?.criterion_description || '', tone, feedback_level),
      improvement_areas: adjustImprovementAreasByLevel(score.areas_for_improvement, feedback_level),
      specific_suggestions: generateSpecificSuggestions(score, criterion?.criterion_description || '', tone, feedback_level)
    }
  })
  
  // Calculate total score
  const total_score = criterion_scores.reduce((sum, s) => sum + s.score, 0)
  const max_score = criterion_scores.length * 4
  const percentage = (total_score / max_score) * 100
  
  // Generate overall summary
  const strengths = extractStrengths(criterion_scores)
  const weaknesses = extractWeaknesses(criterion_scores)
  const overall_comment = generateOverallComment(percentage, strengths, weaknesses, tone)
  const improvement_priority = determineImprovementPriority(criterion_scores)
  
  return {
    criterion_feedbacks,
    overall_summary: {
      total_score,
      strengths,
      weaknesses,
      overall_comment,
      improvement_priority
    }
  }
}

/**
 * Determine feedback tone based on grade level
 */
function getGradeLevelTone(grade_level: string): 'elementary' | 'middle' | 'high' {
  if (grade_level.includes('초등')) return 'elementary'
  if (grade_level.includes('중학')) return 'middle'
  return 'high'
}

/**
 * Generate positive feedback based on score
 */
function generatePositiveFeedback(
  score: { criterion_name: string; score: number; strengths: string },
  description: string,
  tone: string,
  feedbackLevel: string = 'detailed'
): string {
  const { criterion_name, score: points, strengths } = score
  
  if (points === 4) {
    return tone === 'elementary' 
      ? `"${criterion_name}" 부분이 아주 훌륭해요! ${strengths} 정말 잘했어요!`
      : tone === 'middle'
      ? `"${criterion_name}" 영역에서 우수한 수준을 보여주었습니다. ${strengths}`
      : `"${criterion_name}" 측면에서 탁월한 역량을 보였습니다. ${strengths} 이는 매우 높은 수준의 이해도를 나타냅니다.`
  } else if (points === 3) {
    return tone === 'elementary'
      ? `"${criterion_name}" 부분이 잘 되었어요. ${strengths} 조금만 더 노력하면 더 좋아질 거예요!`
      : tone === 'middle'
      ? `"${criterion_name}" 영역에서 양호한 수준입니다. ${strengths} 추가적인 발전 가능성이 보입니다.`
      : `"${criterion_name}" 측면에서 준수한 역량을 보였습니다. ${strengths} 한 단계 더 발전시킬 여지가 있습니다.`
  } else if (points === 2) {
    return tone === 'elementary'
      ? `"${criterion_name}" 부분은 기본은 잘 이해했어요. ${strengths} 조금 더 노력이 필요해요.`
      : tone === 'middle'
      ? `"${criterion_name}" 영역에서 기초적인 이해를 보여주었습니다. ${strengths} 그러나 더 발전시켜야 할 부분이 있습니다.`
      : `"${criterion_name}" 측면에서 기본적인 역량은 갖추었습니다. ${strengths} 하지만 보완이 필요한 영역이 있습니다.`
  } else {
    return tone === 'elementary'
      ? `"${criterion_name}" 부분을 좀 더 연습해야 해요. 선생님이 도와줄게요!`
      : tone === 'middle'
      ? `"${criterion_name}" 영역에서 개선이 필요합니다. 기초부터 다시 다져보면 좋겠습니다.`
      : `"${criterion_name}" 측면에서 상당한 보완이 필요합니다. 기본 개념부터 재정립하는 것이 필요합니다.`
  }
}

/**
 * Adjust improvement areas based on feedback level
 */
function adjustImprovementAreasByLevel(text: string, feedbackLevel: string): string {
  if (feedbackLevel === 'brief') {
    // Return first sentence only
    const sentences = text.split('.')
    return sentences[0] + (sentences[0].endsWith('.') ? '' : '.')
  } else if (feedbackLevel === 'moderate') {
    // Return first 2 sentences
    const sentences = text.split('.')
    return sentences.slice(0, 2).join('.') + (sentences.length > 1 ? '.' : '')
  }
  return text // detailed: return all
}

/**
 * Generate specific, actionable suggestions
 */
function generateSpecificSuggestions(
  score: { criterion_name: string; score: number; areas_for_improvement: string },
  description: string,
  tone: string,
  feedbackLevel: string = 'detailed'
): string {
  const { criterion_name, score: points, areas_for_improvement } = score
  
  const suggestions: string[] = []
  
  // Adjust detail level based on feedback_level
  const maxSuggestions = feedbackLevel === 'brief' ? 1 : feedbackLevel === 'moderate' ? 2 : 3
  
  if (points < 4) {
    if (tone === 'elementary') {
      if (maxSuggestions >= 1) suggestions.push(`💡 다음번에는 이렇게 해보세요:`)
      if (maxSuggestions >= 1) suggestions.push(`1. ${areas_for_improvement}`)
      if (maxSuggestions >= 2) suggestions.push(`2. 선생님께 더 자세히 여쭤보세요`)
      if (maxSuggestions >= 3) suggestions.push(`3. 친구들의 좋은 예를 참고해보세요`)
    } else if (tone === 'middle') {
      if (maxSuggestions >= 1) suggestions.push(`💡 구체적인 개선 방안:`)
      if (maxSuggestions >= 1) suggestions.push(`1. ${areas_for_improvement}`)
      if (maxSuggestions >= 2) suggestions.push(`2. 관련 예시를 더 많이 찾아보세요`)
      if (maxSuggestions >= 3) suggestions.push(`3. 논리적 연결을 강화하기 위해 접속사를 효과적으로 사용하세요`)
    } else {
      if (maxSuggestions >= 1) suggestions.push(`💡 심화 학습 방향:`)
      if (maxSuggestions >= 1) suggestions.push(`1. ${areas_for_improvement}`)
      if (maxSuggestions >= 2) suggestions.push(`2. 학술적 근거를 보강하기 위해 신뢰할 수 있는 출처를 인용하세요`)
      if (maxSuggestions >= 3) suggestions.push(`3. 반론을 고려하여 논증의 설득력을 높이세요`)
    }
  }
  
  return suggestions.join('\n')
}

/**
 * Extract overall strengths from criterion scores
 */
function extractStrengths(scores: Array<{ criterion_name: string; score: number; strengths: string }>): string {
  const highScores = scores.filter(s => s.score >= 3)
  if (highScores.length === 0) {
    return '기본적인 글쓰기 구조를 갖추려고 노력했습니다.'
  }
  
  return highScores.map(s => s.criterion_name).join(', ') + ' 영역에서 우수한 역량을 보였습니다.'
}

/**
 * Extract areas needing improvement
 */
function extractWeaknesses(scores: Array<{ criterion_name: string; score: number }>): string {
  const lowScores = scores.filter(s => s.score <= 2)
  if (lowScores.length === 0) {
    return '전반적으로 균형잡힌 글쓰기를 보여주었습니다.'
  }
  
  return lowScores.map(s => s.criterion_name).join(', ') + ' 영역에서 보완이 필요합니다.'
}

/**
 * Generate overall comment based on performance
 */
function generateOverallComment(
  percentage: number,
  strengths: string,
  weaknesses: string,
  tone: string
): string {
  if (percentage >= 90) {
    return tone === 'elementary'
      ? `아주 훌륭한 논술입니다! ${strengths} 계속 이렇게 열심히 하세요!`
      : tone === 'middle'
      ? `매우 우수한 논술 실력을 보여주었습니다. ${strengths} 이 수준을 유지하며 더욱 발전시켜 나가세요.`
      : `탁월한 논술 역량을 보였습니다. ${strengths} 학술적 글쓰기의 모범적 사례라 할 수 있습니다.`
  } else if (percentage >= 75) {
    return tone === 'elementary'
      ? `잘 쓴 논술이에요! ${strengths} ${weaknesses} 조금만 더 노력하면 완벽해질 거예요!`
      : tone === 'middle'
      ? `양호한 논술 수준입니다. ${strengths} 다만, ${weaknesses} 이 부분을 보완하면 더욱 좋아질 것입니다.`
      : `준수한 논술 역량을 보였습니다. ${strengths} 그러나 ${weaknesses} 이러한 측면을 개선한다면 한 단계 도약할 수 있을 것입니다.`
  } else if (percentage >= 60) {
    return tone === 'elementary'
      ? `기본은 잘 갖춘 논술이에요. ${weaknesses} 선생님과 함께 연습하면 더 잘할 수 있어요!`
      : tone === 'middle'
      ? `기초적인 논술 역량은 갖추었습니다. ${weaknesses} 이 영역을 집중적으로 학습하면 실력이 크게 향상될 것입니다.`
      : `기본적인 논술 구조는 이해하고 있습니다. ${weaknesses} 체계적인 학습을 통해 이러한 부분을 보완할 필요가 있습니다.`
  } else {
    return tone === 'elementary'
      ? `논술 연습이 더 필요해요. 선생님이 도와줄 테니 포기하지 말고 계속 노력해요!`
      : tone === 'middle'
      ? `논술 실력 향상을 위해 기초부터 체계적인 학습이 필요합니다. 꾸준히 연습하면 분명히 좋아질 것입니다.`
      : `논술의 기본 요소에 대한 이해를 높일 필요가 있습니다. 단계적 학습과 지속적인 연습이 필요합니다.`
  }
}

/**
 * Determine which area needs most improvement
 */
function determineImprovementPriority(scores: Array<{ criterion_name: string; score: number }>): string {
  const lowest = scores.reduce((min, s) => s.score < min.score ? s : min, scores[0])
  return `"${lowest.criterion_name}" 영역을 우선적으로 개선하는 것을 추천합니다.`
}
