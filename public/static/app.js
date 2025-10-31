// CoGrader Frontend Application

let criterionCount = 0;

// Default rubric criteria for World War II example
const defaultCriteria = [
  {
    name: 'Understanding and Analysis of Key Concepts',
    description: 'Accurately identified and deeply analyzed the primary causes of World War II.'
  },
  {
    name: 'Use of Evidence and Historical Examples',
    description: 'Used specific and appropriate historical examples to support the argument.'
  },
  {
    name: 'Accuracy of Source Citation',
    description: 'Accurately cited information from the specified resource ("Documentary \'World War II\'") at least twice.'
  },
  {
    name: 'Grammatical Accuracy, Organization, and Flow',
    description: 'Did the essay demonstrate minimal grammatical errors, logical flow (Coherence), and varied sentence structures?'
  }
];

// Initialize default prompt and criteria
window.addEventListener('DOMContentLoaded', () => {
  // Set default assignment prompt
  document.getElementById('assignmentPrompt').value = 
    'Analyze the major causes of World War II, support your arguments using specific historical examples, and explain the impact of the Treaty of Versailles on the outbreak of war. This assignment uses the 12th-grade social studies standards.';
  
  document.getElementById('gradeLevel').value = '12th-grade social studies';
  
  // Add default criteria
  defaultCriteria.forEach(criterion => {
    addCriterion(criterion.name, criterion.description);
  });
  
  // Load history when tab is clicked
  document.getElementById('tab-history').addEventListener('click', loadHistory);
});

// Tab navigation
function showTab(tabName) {
  // Hide all content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  // Remove active state from all tabs
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('border-b-2', 'border-indigo-600', 'text-indigo-600');
    button.classList.add('text-gray-600');
  });
  
  // Show selected content
  document.getElementById(`content-${tabName}`).classList.remove('hidden');
  
  // Activate selected tab
  const activeTab = document.getElementById(`tab-${tabName}`);
  activeTab.classList.add('border-b-2', 'border-indigo-600', 'text-indigo-600');
  activeTab.classList.remove('text-gray-600');
}

// Add a rubric criterion
function addCriterion(defaultName = '', defaultDescription = '') {
  criterionCount++;
  const container = document.getElementById('rubricContainer');
  
  const criterionDiv = document.createElement('div');
  criterionDiv.className = 'criterion-item border border-gray-300 rounded-lg p-4 bg-gray-50';
  criterionDiv.id = `criterion-${criterionCount}`;
  
  criterionDiv.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <h4 class="font-semibold text-gray-700">기준 ${criterionCount}</h4>
      <button 
        type="button" 
        onclick="removeCriterion(${criterionCount})" 
        class="text-red-500 hover:text-red-700"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <input 
      type="text" 
      class="criterion-name w-full px-3 py-2 border border-gray-300 rounded mb-2" 
      placeholder="기준 이름 (예: Understanding and Analysis of Key Concepts)"
      value="${defaultName}"
      required
    />
    <textarea 
      class="criterion-description w-full px-3 py-2 border border-gray-300 rounded" 
      rows="2" 
      placeholder="기준 설명"
      required
    >${defaultDescription}</textarea>
  `;
  
  container.appendChild(criterionDiv);
}

// Remove a rubric criterion
function removeCriterion(id) {
  const element = document.getElementById(`criterion-${id}`);
  if (element) {
    element.remove();
  }
}

// Get all rubric criteria from the form
function getRubricCriteria() {
  const criteria = [];
  const criterionItems = document.querySelectorAll('.criterion-item');
  
  criterionItems.forEach((item, index) => {
    const name = item.querySelector('.criterion-name').value.trim();
    const description = item.querySelector('.criterion-description').value.trim();
    
    if (name && description) {
      criteria.push({
        criterion_name: name,
        criterion_description: description,
        criterion_order: index + 1
      });
    }
  });
  
  return criteria;
}

// Handle form submission
document.getElementById('gradingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get form values
  const assignmentPrompt = document.getElementById('assignmentPrompt').value.trim();
  const gradeLevel = document.getElementById('gradeLevel').value.trim();
  const essayText = document.getElementById('essayText').value.trim();
  const rubricCriteria = getRubricCriteria();
  
  // Validate
  if (!assignmentPrompt || !gradeLevel || !essayText || rubricCriteria.length === 0) {
    alert('모든 필드를 입력해주세요. 최소 1개의 루브릭 기준이 필요합니다.');
    return;
  }
  
  // Show loading, hide form and results
  document.getElementById('gradingForm').parentElement.classList.add('hidden');
  document.getElementById('loadingIndicator').classList.remove('hidden');
  document.getElementById('resultsContainer').classList.add('hidden');
  
  try {
    // Send grading request
    const response = await axios.post('/api/grade', {
      assignment_prompt: assignmentPrompt,
      grade_level: gradeLevel,
      essay_text: essayText,
      rubric_criteria: rubricCriteria
    });
    
    if (response.data.success) {
      // Display results
      displayResults(response.data.grading_result, response.data.essay_id);
    } else {
      throw new Error(response.data.error || 'Grading failed');
    }
  } catch (error) {
    console.error('Grading error:', error);
    alert('채점 중 오류가 발생했습니다: ' + (error.response?.data?.error || error.message));
    
    // Show form again
    document.getElementById('gradingForm').parentElement.classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
});

// Display grading results
function displayResults(result, essayId) {
  const container = document.getElementById('resultsContainer');
  
  const html = `
    <div class="bg-white rounded-lg shadow-lg p-8 result-section">
      <!-- Header -->
      <div class="text-center mb-8 pb-6 border-b-2 border-gray-200">
        <h2 class="text-3xl font-bold text-indigo-900 mb-3">
          <i class="fas fa-award mr-2"></i>채점 결과
        </h2>
        <div class="inline-block bg-indigo-100 rounded-full px-8 py-4">
          <span class="text-5xl font-bold text-indigo-600">${result.total_score}</span>
          <span class="text-2xl text-gray-600">/10</span>
        </div>
      </div>
      
      <!-- Summary Evaluation -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-clipboard-check mr-2 text-indigo-600"></i>
          종합 평가
        </h3>
        <p class="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
          ${result.summary_evaluation}
        </p>
      </div>
      
      <!-- Criterion Scores -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <i class="fas fa-chart-bar mr-2 text-indigo-600"></i>
          기준별 상세 평가
        </h3>
        <div class="space-y-4">
          ${result.criterion_scores.map(score => `
            <div class="criterion-card border border-gray-200 rounded-lg p-5 bg-white">
              <div class="flex items-start justify-between mb-3">
                <h4 class="font-bold text-gray-800 flex-1">${score.criterion_name}</h4>
                <div class="score-badge ${getScoreColor(score.score)}">
                  ${score.score}/4
                </div>
              </div>
              <div class="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <p class="text-sm font-semibold text-green-700 mb-2">
                    <i class="fas fa-check-circle mr-1"></i>강점
                  </p>
                  <p class="text-sm text-gray-700 leading-relaxed">${score.strengths}</p>
                </div>
                <div>
                  <p class="text-sm font-semibold text-orange-700 mb-2">
                    <i class="fas fa-exclamation-circle mr-1"></i>개선점
                  </p>
                  <p class="text-sm text-gray-700 leading-relaxed">${score.areas_for_improvement}</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Overall Comment -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-comment-alt mr-2 text-indigo-600"></i>
          전체 평가
        </h3>
        <p class="text-gray-700 leading-relaxed bg-blue-50 p-5 rounded-lg border-l-4 border-indigo-600">
          ${formatText(result.overall_comment)}
        </p>
      </div>
      
      <!-- Revision Suggestions -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-edit mr-2 text-indigo-600"></i>
          구체적 수정 제안
        </h3>
        <div class="text-gray-700 leading-relaxed bg-yellow-50 p-5 rounded-lg border-l-4 border-yellow-600">
          ${formatText(result.revision_suggestions)}
        </div>
      </div>
      
      <!-- Next Steps Advice -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-lightbulb mr-2 text-indigo-600"></i>
          다음 단계 조언
        </h3>
        <div class="text-gray-700 leading-relaxed bg-green-50 p-5 rounded-lg border-l-4 border-green-600">
          ${formatText(result.next_steps_advice)}
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex justify-center space-x-4 pt-6 border-t-2 border-gray-200">
        <button 
          onclick="resetForm()" 
          class="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition"
        >
          <i class="fas fa-redo mr-2"></i>새 에세이 채점
        </button>
        <button 
          onclick="printResults()" 
          class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
        >
          <i class="fas fa-print mr-2"></i>결과 인쇄
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  container.classList.remove('hidden');
  
  // Scroll to results
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Get color class based on score
function getScoreColor(score) {
  if (score === 4) return 'bg-green-500 text-white';
  if (score === 3) return 'bg-blue-500 text-white';
  if (score === 2) return 'bg-yellow-500 text-white';
  return 'bg-red-500 text-white';
}

// Format text with line breaks and bold
function formatText(text) {
  return text
    .split('\n')
    .map(line => {
      // Bold text between **
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<p class="mb-2">${line}</p>`;
    })
    .join('');
}

// Reset form to grade another essay
function resetForm() {
  document.getElementById('resultsContainer').classList.add('hidden');
  document.getElementById('gradingForm').parentElement.classList.remove('hidden');
  
  // Clear essay text only
  document.getElementById('essayText').value = '';
  
  // Scroll to form
  document.getElementById('gradingForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Print results
function printResults() {
  window.print();
}

// Load grading history
async function loadHistory() {
  const container = document.getElementById('historyContainer');
  container.innerHTML = '<p class="text-gray-500 text-center py-8">기록을 불러오는 중...</p>';
  
  try {
    const response = await axios.get('/api/sessions');
    const sessions = response.data;
    
    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <i class="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
          <p class="text-gray-500 text-lg">아직 채점 기록이 없습니다.</p>
          <button 
            onclick="showTab('grading')" 
            class="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            첫 에세이 채점하기
          </button>
        </div>
      `;
      return;
    }
    
    const html = `
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">날짜</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">과제 프롬프트</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">학년</th>
              <th class="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">에세이 수</th>
              <th class="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">작업</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${sessions.map(session => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm text-gray-700">
                  ${new Date(session.created_at).toLocaleString('ko-KR')}
                </td>
                <td class="px-6 py-4 text-sm text-gray-900">
                  ${session.assignment_prompt.substring(0, 80)}${session.assignment_prompt.length > 80 ? '...' : ''}
                </td>
                <td class="px-6 py-4 text-sm text-gray-700">
                  ${session.grade_level}
                </td>
                <td class="px-6 py-4 text-sm text-center">
                  <span class="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                    ${session.essay_count}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-center">
                  <button 
                    onclick="viewSession(${session.id})"
                    class="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <i class="fas fa-eye mr-1"></i>상세보기
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading history:', error);
    container.innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
        <p>기록을 불러오는데 실패했습니다.</p>
      </div>
    `;
  }
}

// View session details
async function viewSession(sessionId) {
  const container = document.getElementById('historyContainer');
  container.innerHTML = '<p class="text-gray-500 text-center py-8">세션 정보를 불러오는 중...</p>';
  
  try {
    const response = await axios.get(`/api/session/${sessionId}`);
    const session = response.data;
    
    const html = `
      <div>
        <button 
          onclick="loadHistory()" 
          class="mb-6 text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <i class="fas fa-arrow-left mr-2"></i>목록으로 돌아가기
        </button>
        
        <div class="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 class="text-xl font-bold text-gray-800 mb-3">세션 정보</h3>
          <p class="text-sm text-gray-600 mb-2"><strong>날짜:</strong> ${new Date(session.created_at).toLocaleString('ko-KR')}</p>
          <p class="text-sm text-gray-600 mb-2"><strong>학년:</strong> ${session.grade_level}</p>
          <p class="text-sm text-gray-600 mb-3"><strong>과제:</strong> ${session.assignment_prompt}</p>
          
          <h4 class="font-semibold text-gray-700 mt-4 mb-2">루브릭 기준:</h4>
          <ul class="list-disc list-inside space-y-1">
            ${session.rubric_criteria.map(c => `
              <li class="text-sm text-gray-600">${c.criterion_name}</li>
            `).join('')}
          </ul>
        </div>
        
        <h3 class="text-xl font-bold text-gray-800 mb-4">채점된 에세이 (${session.essays.length}개)</h3>
        
        ${session.essays.length === 0 ? 
          '<p class="text-gray-500 text-center py-8">아직 채점된 에세이가 없습니다.</p>' :
          `<div class="space-y-4">
            ${session.essays.map(essay => `
              <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <p class="text-sm text-gray-600 mb-1">
                      제출일: ${new Date(essay.submitted_at).toLocaleString('ko-KR')}
                    </p>
                    <p class="text-sm text-gray-700 mb-2">
                      ${essay.essay_text.substring(0, 150)}${essay.essay_text.length > 150 ? '...' : ''}
                    </p>
                    ${essay.total_score ? 
                      `<span class="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                        점수: ${essay.total_score}/10
                      </span>` : 
                      '<span class="text-gray-500 text-sm">채점 대기 중</span>'
                    }
                  </div>
                  ${essay.total_score ? 
                    `<button 
                      onclick="viewResult(${essay.id})"
                      class="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      결과 보기
                    </button>` : ''
                  }
                </div>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    `;
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading session:', error);
    container.innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
        <p>세션 정보를 불러오는데 실패했습니다.</p>
        <button 
          onclick="loadHistory()" 
          class="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          목록으로 돌아가기
        </button>
      </div>
    `;
  }
}

// View grading result
async function viewResult(essayId) {
  const container = document.getElementById('historyContainer');
  container.innerHTML = '<p class="text-gray-500 text-center py-8">채점 결과를 불러오는 중...</p>';
  
  try {
    const response = await axios.get(`/api/result/${essayId}`);
    const result = response.data;
    
    const html = `
      <div>
        <button 
          onclick="loadHistory()" 
          class="mb-6 text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <i class="fas fa-arrow-left mr-2"></i>목록으로 돌아가기
        </button>
        
        ${generateResultHTML(result)}
      </div>
    `;
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading result:', error);
    container.innerHTML = `
      <div class="text-center py-8 text-red-600">
        <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
        <p>결과를 불러오는데 실패했습니다.</p>
        <button 
          onclick="loadHistory()" 
          class="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          목록으로 돌아가기
        </button>
      </div>
    `;
  }
}

// Generate result HTML (reusable)
function generateResultHTML(result) {
  return `
    <div class="bg-white rounded-lg shadow-lg p-8">
      <!-- Header -->
      <div class="text-center mb-8 pb-6 border-b-2 border-gray-200">
        <h2 class="text-3xl font-bold text-indigo-900 mb-3">
          <i class="fas fa-award mr-2"></i>채점 결과
        </h2>
        <div class="inline-block bg-indigo-100 rounded-full px-8 py-4">
          <span class="text-5xl font-bold text-indigo-600">${result.total_score}</span>
          <span class="text-2xl text-gray-600">/10</span>
        </div>
        <p class="text-sm text-gray-500 mt-3">채점일: ${new Date(result.graded_at).toLocaleString('ko-KR')}</p>
      </div>
      
      <!-- Summary Evaluation -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-clipboard-check mr-2 text-indigo-600"></i>
          종합 평가
        </h3>
        <p class="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
          ${result.summary_evaluation}
        </p>
      </div>
      
      <!-- Criterion Scores -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <i class="fas fa-chart-bar mr-2 text-indigo-600"></i>
          기준별 상세 평가
        </h3>
        <div class="space-y-4">
          ${result.criterion_scores.map(score => `
            <div class="criterion-card border border-gray-200 rounded-lg p-5 bg-white">
              <div class="flex items-start justify-between mb-3">
                <h4 class="font-bold text-gray-800 flex-1">${score.criterion_name}</h4>
                <div class="score-badge ${getScoreColor(score.score)}">
                  ${score.score}/4
                </div>
              </div>
              <div class="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <p class="text-sm font-semibold text-green-700 mb-2">
                    <i class="fas fa-check-circle mr-1"></i>강점
                  </p>
                  <p class="text-sm text-gray-700 leading-relaxed">${score.strengths}</p>
                </div>
                <div>
                  <p class="text-sm font-semibold text-orange-700 mb-2">
                    <i class="fas fa-exclamation-circle mr-1"></i>개선점
                  </p>
                  <p class="text-sm text-gray-700 leading-relaxed">${score.areas_for_improvement}</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Overall Comment -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-comment-alt mr-2 text-indigo-600"></i>
          전체 평가
        </h3>
        <p class="text-gray-700 leading-relaxed bg-blue-50 p-5 rounded-lg border-l-4 border-indigo-600">
          ${formatText(result.overall_comment)}
        </p>
      </div>
      
      <!-- Revision Suggestions -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-edit mr-2 text-indigo-600"></i>
          구체적 수정 제안
        </h3>
        <div class="text-gray-700 leading-relaxed bg-yellow-50 p-5 rounded-lg border-l-4 border-yellow-600">
          ${formatText(result.revision_suggestions)}
        </div>
      </div>
      
      <!-- Next Steps Advice -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-800 mb-3 flex items-center">
          <i class="fas fa-lightbulb mr-2 text-indigo-600"></i>
          다음 단계 조언
        </h3>
        <div class="text-gray-700 leading-relaxed bg-green-50 p-5 rounded-lg border-l-4 border-green-600">
          ${formatText(result.next_steps_advice)}
        </div>
      </div>
    </div>
  `;
}
