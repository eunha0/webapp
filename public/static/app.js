// AI 논술 평가 Frontend Application

let criterionCount = 0;
let materialCount = 0;
const MAX_MATERIALS = 11; // 4 initial + 7 more

// Default rubric criteria for World War II example
const defaultCriteria = [
  {
    name: '핵심 개념의 이해와 분석',
    description: '제2차 세계대전의 주요 원인을 정확하게 파악하고 깊이 있게 분석했습니다.'
  },
  {
    name: '증거와 역사적 사례 활용',
    description: '논거를 뒷받침하기 위해 구체적이고 적절한 역사적 사례를 사용했습니다.'
  },
  {
    name: '출처 인용의 정확성',
    description: '지정된 자료에서 정보를 정확하게 최소 두 번 인용했습니다.'
  },
  {
    name: '문법 정확성, 구성 및 흐름',
    description: '최소한의 문법 오류, 논리적 흐름, 다양한 문장 구조를 보여줍니다.'
  }
];

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
  // Leave assignment prompt blank (removed default value)
  // Grade level remains unselected (user selects)
  
  // Load platform rubrics
  loadPlatformRubrics();
  
  // Add 4 default criteria for custom rubric
  defaultCriteria.forEach(criterion => {
    addCriterion(criterion.name, criterion.description);
  });
  
  // Add 4 initial material slots
  for (let i = 0; i < 4; i++) {
    addMaterial();
  }
});

// Scroll functions
function scrollToGrader() {
  document.getElementById('grader').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToDemo() {
  document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Switch between platform and custom rubric
function switchRubricType(type) {
  const platformBtn = document.getElementById('platformRubricBtn');
  const customBtn = document.getElementById('customRubricBtn');
  const platformContainer = document.getElementById('platformRubricContainer');
  const customContainer = document.getElementById('customRubricContainer');
  
  if (type === 'platform') {
    platformBtn.classList.add('active');
    customBtn.classList.remove('active');
    platformContainer.classList.remove('hidden');
    customContainer.classList.add('hidden');
  } else {
    customBtn.classList.add('active');
    platformBtn.classList.remove('active');
    customContainer.classList.remove('hidden');
    platformContainer.classList.add('hidden');
  }
}

// Switch between text input and file upload for essay
function switchEssayInputType(type) {
  const textInputBtn = document.getElementById('textInputBtn');
  const fileInputBtn = document.getElementById('fileInputBtn');
  const textInputContainer = document.getElementById('textInputContainer');
  const fileInputContainer = document.getElementById('fileInputContainer');
  
  if (type === 'text') {
    textInputBtn.classList.add('active');
    fileInputBtn.classList.remove('active');
    textInputContainer.classList.remove('hidden');
    fileInputContainer.classList.add('hidden');
  } else {
    fileInputBtn.classList.add('active');
    textInputBtn.classList.remove('active');
    fileInputContainer.classList.remove('hidden');
    textInputContainer.classList.add('hidden');
  }
}

// Handle file selection
let selectedFile = null;

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  selectedFile = file;
  
  // Show file preview
  const filePreview = document.getElementById('filePreview');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  filePreview.classList.remove('hidden');
  
  // If image, show preview
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      imagePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    imagePreview.classList.add('hidden');
  }
}

// Clear selected file
function clearFile() {
  selectedFile = null;
  document.getElementById('essayFile').value = '';
  document.getElementById('filePreview').classList.add('hidden');
  document.getElementById('imagePreview').classList.add('hidden');
}

// Upload file and extract text (for images and PDFs)
async function uploadFileAndExtractText(file) {
  // Determine endpoint based on file type
  let endpoint = '/api/upload/image';
  if (file.type === 'application/pdf') {
    endpoint = '/api/upload/pdf';
  }
  
  // Create FormData
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // Show loading state
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'file-upload-loading';
    loadingMessage.className = 'mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg';
    loadingMessage.innerHTML = `
      <div class="flex items-center">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
        <div>
          <p class="font-semibold text-blue-900">파일 처리 중...</p>
          <p class="text-sm text-blue-700">텍스트를 추출하고 있습니다. 잠시만 기다려주세요.</p>
        </div>
      </div>
    `;
    
    const filePreview = document.getElementById('filePreview');
    if (!document.getElementById('file-upload-loading')) {
      filePreview.insertAdjacentElement('afterend', loadingMessage);
    }
    
    // Make API request
    const response = await axios.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    // Remove loading message
    const loadingEl = document.getElementById('file-upload-loading');
    if (loadingEl) {
      loadingEl.remove();
    }
    
    if (response.data.success && response.data.extracted_text) {
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-lg';
      successMessage.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
            <div>
              <p class="font-semibold text-green-900">텍스트 추출 완료!</p>
              <p class="text-sm text-green-700">
                ${response.data.extracted_text.length}자 추출 
                (처리 시간: ${response.data.processing_time_ms}ms)
              </p>
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" class="text-green-700 hover:text-green-900">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      filePreview.insertAdjacentElement('afterend', successMessage);
      
      // Auto-remove success message after 5 seconds
      setTimeout(() => {
        if (successMessage && successMessage.parentElement) {
          successMessage.remove();
        }
      }, 5000);
      
      return response.data.extracted_text;
    } else {
      throw new Error(response.data.error || '텍스트 추출에 실패했습니다');
    }
  } catch (error) {
    // Remove loading message
    const loadingEl = document.getElementById('file-upload-loading');
    if (loadingEl) {
      loadingEl.remove();
    }
    
    // Show error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg';
    errorMessage.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <i class="fas fa-exclamation-circle text-red-600 text-2xl mr-3"></i>
          <div>
            <p class="font-semibold text-red-900">파일 처리 실패</p>
            <p class="text-sm text-red-700">${error.response?.data?.error || error.message}</p>
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="text-red-700 hover:text-red-900">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    const filePreview = document.getElementById('filePreview');
    filePreview.insertAdjacentElement('afterend', errorMessage);
    
    throw error;
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Add reference material
function addMaterial() {
  if (materialCount >= MAX_MATERIALS) {
    alert('최대 11개의 자료만 첨부할 수 있습니다.');
    return;
  }
  
  materialCount++;
  const container = document.getElementById('materialsContainer');
  
  const materialDiv = document.createElement('div');
  materialDiv.className = 'material-item border border-gray-200 rounded-lg p-3 bg-white';
  materialDiv.id = `material-${materialCount}`;
  
  materialDiv.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="flex-shrink-0">
        <span class="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
          ${materialCount}
        </span>
      </div>
      <input 
        type="text" 
        class="material-input flex-1 px-3 py-2 border border-gray-200 rounded text-sm" 
        placeholder="자료 이름 또는 URL (예: 역사 다큐멘터리, https://example.com/doc.pdf)"
      />
      <button 
        type="button" 
        onclick="removeMaterial(${materialCount})" 
        class="text-red-500 hover:text-red-700 text-sm"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  container.appendChild(materialDiv);
  
  // Update button text
  updateMaterialButtonText();
}

// Remove reference material
function removeMaterial(id) {
  const element = document.getElementById(`material-${id}`);
  if (element) {
    element.remove();
    materialCount--;
    updateMaterialButtonText();
  }
}

// Update material button text
function updateMaterialButtonText() {
  const button = document.querySelector('button[onclick="addMaterial()"]');
  if (button) {
    const remaining = MAX_MATERIALS - materialCount;
    if (remaining > 0) {
      button.innerHTML = `<i class="fas fa-plus mr-2"></i>자료 추가 (${remaining}개 더 가능)`;
      button.disabled = false;
      button.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      button.innerHTML = `<i class="fas fa-check mr-2"></i>최대 개수 도달`;
      button.disabled = true;
      button.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }
}

// Add a rubric criterion
function addCriterion(defaultName = '', defaultDescription = '') {
  criterionCount++;
  const container = document.getElementById('rubricContainer');
  
  const criterionDiv = document.createElement('div');
  criterionDiv.className = 'criterion-item border border-gray-200 rounded-lg p-3 bg-white mb-2';
  criterionDiv.id = `criterion-${criterionCount}`;
  
  criterionDiv.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <span class="text-xs font-semibold text-gray-600">기준 ${criterionCount}</span>
      <button 
        type="button" 
        onclick="removeCriterion(${criterionCount})" 
        class="text-red-500 hover:text-red-700 text-xs"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <input 
      type="text" 
      class="criterion-name w-full px-3 py-2 border border-gray-200 rounded mb-2 text-sm" 
      placeholder="기준 이름 (예: 논제 및 논거)"
      value="${defaultName}"
      required
    />
    <textarea 
      class="criterion-description w-full px-3 py-2 border border-gray-200 rounded text-sm" 
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
  
  // Check which rubric type is active
  const platformBtn = document.getElementById('platformRubricBtn');
  const isPlatformRubric = platformBtn.classList.contains('active');
  
  if (isPlatformRubric) {
    // Use platform rubric - return predefined criteria based on selection
    const platformSelect = document.getElementById('platformRubric');
    const rubricType = platformSelect.value;
    
    // Define platform rubric criteria
    if (rubricType === 'standard') {
      return defaultCriteria.map((criterion, index) => ({
        criterion_name: criterion.name,
        criterion_description: criterion.description,
        criterion_order: index + 1
      }));
    } else if (rubricType === 'detailed') {
      // 6 criteria for detailed rubric
      return [
        { criterion_name: '논제의 명확성', criterion_description: '논제가 명확하고 구체적으로 제시되었습니다.', criterion_order: 1 },
        { criterion_name: '논거의 타당성', criterion_description: '논거가 논리적이고 설득력 있게 제시되었습니다.', criterion_order: 2 },
        { criterion_name: '증거 활용', criterion_description: '적절한 증거와 사례를 효과적으로 활용했습니다.', criterion_order: 3 },
        { criterion_name: '구조와 조직', criterion_description: '글의 구조가 체계적이고 논리적으로 조직되었습니다.', criterion_order: 4 },
        { criterion_name: '언어 사용', criterion_description: '문법, 어휘, 문장 구조가 정확하고 적절합니다.', criterion_order: 5 },
        { criterion_name: '창의성과 통찰', criterion_description: '독창적인 관점과 깊이 있는 통찰을 보여줍니다.', criterion_order: 6 }
      ];
    } else if (rubricType === 'simple') {
      // 3 criteria for simple rubric
      return [
        { criterion_name: '내용의 이해', criterion_description: '주제에 대한 이해가 정확하고 충분합니다.', criterion_order: 1 },
        { criterion_name: '논리적 전개', criterion_description: '논리적으로 일관되게 전개되었습니다.', criterion_order: 2 },
        { criterion_name: '표현의 적절성', criterion_description: '문법과 어휘가 적절하게 사용되었습니다.', criterion_order: 3 }
      ];
    } else if (rubricType === 'nyregents') {
      // NY Regents Argumentative Writing Rubric - 4 criteria
      return [
        { criterion_name: '내용과 분석 (주장 제시)', criterion_description: '구체적인 주장을 제시하고, 자료와 주제를 적절히 분석하며, 반론을 평가합니다.', criterion_order: 1 },
        { criterion_name: '증거 활용 능력', criterion_description: '관련 증거를 활용하여 충분하고 적절한 근거를 제시하며, 표절을 피하고 허용 가능한 인용 형식을 사용합니다.', criterion_order: 2 },
        { criterion_name: '일관성과 구성', criterion_description: '과제에 대한 수용 가능한 집중도를 유지하고, 체계적이고 논리적인 구조로 글을 구성합니다.', criterion_order: 3 },
        { criterion_name: '언어 사용과 규칙', criterion_description: '적절한 어휘와 문장 구조를 사용하며, 문법과 맞춤법 규칙을 준수합니다.', criterion_order: 4 }
      ];
    }
  } else {
    // Use custom rubric - collect from form
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
  }
  
  return criteria;
}

// Handle form submission
document.getElementById('gradingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get form values
  const assignmentPrompt = document.getElementById('assignmentPrompt').value.trim();
  const gradeLevel = document.getElementById('gradeLevel').value.trim();
  const rubricCriteria = getRubricCriteria();
  
  // Check which input type is active
  const textInputBtn = document.getElementById('textInputBtn');
  const isTextInput = textInputBtn.classList.contains('active');
  
  let essayText = '';
  
  if (isTextInput) {
    // Get text from textarea
    essayText = document.getElementById('essayText').value.trim();
    
    if (!essayText) {
      alert('학생 논술 내용을 입력해주세요.');
      return;
    }
  } else {
    // Handle file upload
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }
    
    // Check file type
    const fileType = selectedFile.type;
    const supportedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    
    if (!supportedTypes.includes(fileType)) {
      alert('지원하지 않는 파일 형식입니다. 이미지(JPG, PNG) 또는 PDF 파일을 선택해주세요.');
      return;
    }
    
    // Show loading state
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('loadingIndicator').classList.remove('hidden');
    
    try {
      // Upload file and extract text
      essayText = await uploadFileAndExtractText(selectedFile);
      
      if (!essayText || essayText.trim().length === 0) {
        throw new Error('파일에서 텍스트를 추출할 수 없습니다.');
      }
      
      // Show main interface again for form validation
      document.getElementById('mainInterface').classList.remove('hidden');
      document.getElementById('loadingIndicator').classList.add('hidden');
    } catch (error) {
      console.error('File upload error:', error);
      alert('파일 처리 오류: ' + (error.response?.data?.error || error.message));
      
      // Show form again
      document.getElementById('mainInterface').classList.remove('hidden');
      document.getElementById('loadingIndicator').classList.add('hidden');
      return;
    }
  }
  
  // Validate
  if (!assignmentPrompt || !gradeLevel || !essayText || rubricCriteria.length === 0) {
    alert('모든 필드를 입력해주세요. 최소 1개의 루브릭 기준이 필요합니다.');
    return;
  }
  
  // Show loading, hide main interface
  document.getElementById('mainInterface').classList.add('hidden');
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
    alert('채점 오류: ' + (error.response?.data?.error || error.message));
    
    // Show form again
    document.getElementById('mainInterface').classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
});

// Display grading results
function displayResults(result, essayId) {
  const container = document.getElementById('resultsContainer');
  
  const html = `
    <div class="bg-white rounded-xl shadow-2xl p-8 border border-gray-200 result-section mt-8">
      <!-- Header -->
      <div class="text-center mb-8 pb-6 border-b-2 border-navy-100">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-navy-700 to-navy-900 rounded-full mb-4">
          <i class="fas fa-award text-3xl text-white"></i>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 mb-4">
          채점 완료!
        </h2>
        <div class="inline-block bg-gradient-to-r from-navy-100 to-blue-100 rounded-2xl px-10 py-6">
          <span class="text-6xl font-bold bg-gradient-to-r from-navy-700 to-navy-900 bg-clip-text text-transparent">${result.total_score}</span>
          <span class="text-3xl text-gray-600">/10</span>
        </div>
      </div>
      
      <!-- Summary Evaluation -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-900 mb-3 flex items-center">
          <div class="w-8 h-8 bg-navy-100 rounded-lg flex items-center justify-center mr-2">
            <i class="fas fa-clipboard-check text-navy-700"></i>
          </div>
          종합 평가
        </h3>
        <p class="text-gray-700 leading-relaxed bg-gradient-to-r from-navy-50 to-blue-50 p-5 rounded-lg border-l-4 border-navy-700">
          ${result.summary_evaluation}
        </p>
      </div>
      
      <!-- Criterion Scores -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-2">
            <i class="fas fa-chart-bar text-blue-600"></i>
          </div>
          상세 루브릭 점수
        </h3>
        <div class="space-y-4">
          ${result.criterion_scores.map(score => `
            <div class="criterion-card border border-gray-200 rounded-xl p-6 bg-white hover:border-navy-300">
              <div class="flex items-start justify-between mb-4">
                <h4 class="font-bold text-gray-900 flex-1 text-lg">${score.criterion_name}</h4>
                <div class="score-badge ${getScoreColor(score.score)}">
                  ${score.score}/4
                </div>
              </div>
              <div class="grid md:grid-cols-2 gap-6 mt-4">
                <div class="bg-navy-50 p-4 rounded-lg">
                  <p class="text-sm font-bold text-navy-800 mb-2 flex items-center">
                    <i class="fas fa-check-circle mr-2"></i>강점
                  </p>
                  <p class="text-sm text-gray-700 leading-relaxed">${score.strengths}</p>
                </div>
                <div class="bg-orange-50 p-4 rounded-lg">
                  <p class="text-sm font-bold text-orange-800 mb-2 flex items-center">
                    <i class="fas fa-arrow-up mr-2"></i>개선할 점
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
        <h3 class="text-xl font-bold text-gray-900 mb-3 flex items-center">
          <div class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-2">
            <i class="fas fa-comment-alt text-indigo-600"></i>
          </div>
          전체 평가
        </h3>
        <div class="text-gray-700 leading-relaxed bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border-l-4 border-indigo-500">
          ${formatText(result.overall_comment)}
        </div>
      </div>
      
      <!-- Revision Suggestions -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-900 mb-3 flex items-center">
          <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-2">
            <i class="fas fa-edit text-yellow-600"></i>
          </div>
          구체적 수정 제안
        </h3>
        <div class="text-gray-700 leading-relaxed bg-yellow-50 p-6 rounded-xl border-l-4 border-yellow-500">
          ${formatText(result.revision_suggestions)}
        </div>
      </div>
      
      <!-- Next Steps Advice -->
      <div class="mb-8">
        <h3 class="text-xl font-bold text-gray-900 mb-3 flex items-center">
          <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-2">
            <i class="fas fa-lightbulb text-purple-600"></i>
          </div>
          향상을 위한 다음 단계
        </h3>
        <div class="text-gray-700 leading-relaxed bg-purple-50 p-6 rounded-xl border-l-4 border-purple-500">
          ${formatText(result.next_steps_advice)}
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex flex-col sm:flex-row justify-center gap-4 pt-6 border-t-2 border-gray-100">
        <button 
          onclick="resetForm()" 
          class="px-8 py-4 bg-gradient-to-r from-navy-700 to-navy-900 text-white font-bold rounded-lg hover:shadow-xl transition transform hover:scale-105"
        >
          <i class="fas fa-redo mr-2"></i>다른 논술 채점하기
        </button>
        <button 
          onclick="printResults()" 
          class="px-8 py-4 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 transition"
        >
          <i class="fas fa-print mr-2"></i>결과 인쇄하기
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
  if (score === 4) return 'bg-gradient-to-r from-navy-600 to-navy-800 text-white';
  if (score === 3) return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
  if (score === 2) return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
  return 'bg-gradient-to-r from-red-500 to-pink-500 text-white';
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
  document.getElementById('mainInterface').classList.remove('hidden');
  
  // Clear essay text only
  document.getElementById('essayText').value = '';
  
  // Scroll to grader
  scrollToGrader();
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

// Load platform rubrics for landing page
async function loadPlatformRubrics() {
  try {
    const response = await axios.get('/api/resources/rubric');
    const rubrics = response.data;
    
    const select = document.getElementById('platformRubric');
    
    if (!select) return;
    
    // Add default built-in rubrics
    const builtInOptions = [
      { value: 'standard', text: '표준 논술 루브릭 (4개 기준)' },
      { value: 'detailed', text: '상세 논술 루브릭 (6개 기준)' },
      { value: 'simple', text: '간단 논술 루브릭 (3개 기준)' },
      { value: 'nyregents', text: '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭 (4개 기준)' }
    ];
    
    // Sort database rubrics in specific order
    // Order: 분석적 글쓰기 (ID:2) -> 중학교 (ID:1) -> 초등학교 (ID:3)
    const sortOrder = {
      '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭': 1,
      '뉴욕 주 중학교 글쓰기 루브릭': 2,
      '뉴욕 주 초등학교 글쓰기 루브릭': 3
    };
    
    const sortedRubrics = rubrics.sort((a, b) => {
      const orderA = sortOrder[a.title] || 999;
      const orderB = sortOrder[b.title] || 999;
      return orderA - orderB;
    });
    
    // Add database rubrics
    const dbOptions = sortedRubrics.map(rubric => ({
      value: 'db_' + rubric.id,
      text: rubric.title
    }));
    
    // Combine all options
    const allOptions = [...builtInOptions, ...dbOptions];
    
    select.innerHTML = allOptions.map(opt => 
      `<option value="${opt.value}">${opt.text}</option>`
    ).join('');
    
  } catch (error) {
    console.error('Failed to load platform rubrics:', error);
    // Keep default options on error
    const select = document.getElementById('platformRubric');
    if (select) {
      select.innerHTML = `
        <option value="standard">표준 논술 루브릭 (4개 기준)</option>
        <option value="detailed">상세 논술 루브릭 (6개 기준)</option>
        <option value="simple">간단 논술 루브릭 (3개 기준)</option>
        <option value="nyregents">뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭 (4개 기준)</option>
      `;
    }
  }
}
