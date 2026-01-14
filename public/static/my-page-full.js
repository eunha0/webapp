// CRITICAL: Storage functions are defined in HTML page (STORAGE_UTILS_SCRIPT)
// DO NOT redefine them here to avoid infinite recursion!

// Session check BEFORE window.onload
console.log('[DEBUG] Starting my-page-full.js');
console.log('[DEBUG] Checking session_id...');
const sessionId = window.getStorageItem('session_id');
console.log('[DEBUG] Session ID:', sessionId ? 'EXISTS' : 'NULL');

if (!sessionId) {
  console.error('[DEBUG] No session ID found! Redirecting to login...');
  alert('로그인이 필요합니다.');
  window.location.href = '/login';
  // Stop script execution - don't define window.onload
} else {
  console.log('[DEBUG] Session ID verified, continuing to window.onload...');
  
  // Wait for all scripts to load, then initialize
  window.addEventListener('load', function() {
    console.log('[DEBUG] window.onload fired - all scripts loaded');
    
    let currentAssignmentId = null;
    let criterionCounter = 0;
            try {
              // Check if marked library is available
              if (typeof marked === 'undefined') {
                console.warn('Marked library not available, returning plain text');
                // Simple fallback: convert newlines to <br> and escape HTML
                return markdown
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br>');
              }
              
              // Use marked.js to convert Markdown to HTML
              const rawHtml = marked.parse(markdown);
              
              // Check if DOMPurify is available
              if (typeof DOMPurify === 'undefined') {
                console.warn('DOMPurify not available, using raw HTML');
                return rawHtml;
              }
              
              // Use DOMPurify to sanitize HTML (prevent XSS)
              return DOMPurify.sanitize(rawHtml);
            } catch (error) {
              console.error('Markdown conversion error:', error);
              // Fallback to plain text with basic HTML escaping
              return markdown
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
            }
          }

          // Initialize axios after it's loaded
          function initializeAxios() {
            console.log('[DEBUG] initializeAxios called, checking axios...');
            if (typeof axios === 'undefined') {
              console.warn('[DEBUG] Axios not loaded yet, retrying in 100ms...');
              setTimeout(initializeAxios, 100);
              return;
            }
            
            console.log('[DEBUG] Axios found! Configuring...');
            
            // Configure axios to include session ID in all requests
            axios.defaults.headers.common['X-Session-ID'] = sessionId;

            // Handle authentication errors
            let authErrorShown = false;
            axios.interceptors.response.use(
              response => response,
              error => {
                if (error.response && error.response.status === 401) {
                  console.error('401 Unauthorized error:', error.response.data);
                  console.log('Session ID:', sessionId);
                  
                  if (!authErrorShown) {
                    authErrorShown = true;
                    alert('세션이 만료되었습니다. 다시 로그인해주세요.');
                    removeStorageItem('session_id');
                    window.location.href = '/login';
                  }
                }
                return Promise.reject(error);
              }
            );
            
            console.log('[DEBUG] Axios configured successfully');
            
            // Initialize page after axios is ready
            console.log('[DEBUG] Calling initializePage...');
            initializePage();
          }
          
          // Page initialization function
          function initializePage() {
            console.log('[DEBUG] initializePage called');
            console.log('[DEBUG] Axios available?', typeof axios !== 'undefined');
            console.log('[DEBUG] Calling loadUserInfo...');
            loadUserInfo().catch(e => console.error('[DEBUG] loadUserInfo failed:', e));
            console.log('[DEBUG] Calling loadPlatformRubrics...');
            loadPlatformRubrics().catch(e => console.error('[DEBUG] loadPlatformRubrics failed:', e));
            console.log('[DEBUG] Calling loadAssignments...');
            loadAssignments().catch(e => console.error('[DEBUG] loadAssignments failed:', e));
          }
          
          // Call initialization
          console.log('[DEBUG] Starting axios initialization...');
          initializeAxios();

          // Switch between tabs
          function switchTab(tab) {
            const assignmentsTab = document.getElementById('assignmentsTab');
            const historyTab = document.getElementById('historyTab');
            const assignmentsContent = document.getElementById('assignmentsContent');
            const historyContent = document.getElementById('historyContent');

            if (tab === 'assignments') {
              assignmentsTab.classList.add('active');
              historyTab.classList.remove('active');
              assignmentsContent.classList.remove('hidden');
              historyContent.classList.add('hidden');
              loadAssignments();
            } else {
              historyTab.classList.add('active');
              assignmentsTab.classList.remove('active');
              historyContent.classList.remove('hidden');
              assignmentsContent.classList.add('hidden');
              loadHistory();
            }
          }

          // Load platform rubrics for assignment creation
          // Platform rubric definitions with PDF paths
          const platformRubricData = [
            { value: 'standard', text: '표준 논술 루브릭(4개 기준)', pdf: '/rubric-pdfs/표준 논술 루브릭(4개 기준).pdf' },
            { value: 'kr_elementary', text: '초등학생용 평가 기준', pdf: '/rubric-pdfs/초등학생용 평가 기준.pdf' },
            { value: 'kr_middle', text: '중학생용 평가 기준', pdf: '/rubric-pdfs/중학생용 평가 기준.pdf' },
            { value: 'kr_high', text: '고등학생용 평가 기준', pdf: '/rubric-pdfs/고등학생용 평가 기준.pdf' },
            { value: 'nyregents', text: '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭', pdf: '/rubric-pdfs/뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.pdf' },
            { value: 'nyregents_analytical', text: '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭', pdf: '/rubric-pdfs/뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.pdf' },
            { value: 'ny_middle', text: '뉴욕 주 중학교 논술 루브릭', pdf: '/rubric-pdfs/뉴욕 주 중학교 논술 루브릭.pdf' },
            { value: 'ny_elementary', text: '뉴욕 주 초등학교 논술 루브릭', pdf: '/rubric-pdfs/뉴욕 주 초등학교 논술 루브릭.pdf' },
            { value: 'ib_myp_highschool', text: 'IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭', pdf: '/rubric-pdfs/IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.pdf' },
            { value: 'ib_myp_middleschool', text: 'IB 중등 프로그램 중학교 개인과 사회 논술 루브릭', pdf: '/rubric-pdfs/IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.pdf' },
            { value: 'ib_myp_science', text: 'IB 중등 프로그램 과학 논술 루브릭', pdf: '/rubric-pdfs/IB 중등 프로그램 과학 논술 루브릭.pdf' }
          ];

          async function loadPlatformRubrics() {
            const container = document.getElementById('platformRubricList');
            if (!container) return;
            
            // Create card-based rubric list
            container.innerHTML = platformRubricData.map(rubric => `
              <div class="rubric-card border-2 border-gray-200 rounded-lg p-4 hover:border-navy-700 hover:shadow-md transition cursor-pointer"
                   onclick="previewRubric('${rubric.value}', '${rubric.text}', '${rubric.pdf}')">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">${rubric.text}</h3>
                    <p class="text-sm text-gray-500 mt-1">클릭하여 미리보기</p>
                  </div>
                  <i class="fas fa-file-pdf text-red-600 text-2xl ml-3"></i>
                </div>
              </div>
            `).join('');
          }

          // Preview rubric PDF
          let currentRubricSelection = null;
          
          function previewRubric(value, text, pdfPath) {
            currentRubricSelection = { value, text, pdfPath };
            
            const modal = document.getElementById('rubricPreviewModal');
            const titleEl = document.getElementById('rubricPreviewTitle');
            const containerEl = document.getElementById('rubricPdfContainer');
            
            // Encode the PDF path to handle Korean characters
            const encodedPath = pdfPath.split('/').map(part => encodeURIComponent(part)).join('/');
            
            titleEl.textContent = text;
            containerEl.innerHTML = `
              <embed src="${encodedPath}" type="application/pdf" width="100%" height="700px" 
                     class="border border-gray-300 rounded-lg" />
            `;
            
            modal.classList.remove('hidden');
          }
          
          function closeRubricPreview() {
            const modal = document.getElementById('rubricPreviewModal');
            modal.classList.add('hidden');
            currentRubricSelection = null;
          }
          
          function selectCurrentRubric() {
            if (!currentRubricSelection) return;
            
            // Set the hidden input value
            const hiddenInput = document.getElementById('selectedPlatformRubric');
            hiddenInput.value = currentRubricSelection.value;
            
            // Highlight selected card
            const cards = document.querySelectorAll('#platformRubricList .rubric-card');
            cards.forEach(card => {
              card.classList.remove('border-navy-700', 'bg-navy-50');
              card.classList.add('border-gray-200');
            });
            
            const selectedCard = Array.from(cards).find(card => 
              card.getAttribute('onclick').includes(currentRubricSelection.value)
            );
            
            if (selectedCard) {
              selectedCard.classList.remove('border-gray-200');
              selectedCard.classList.add('border-navy-700', 'bg-navy-50');
            }
            
            // Close modal
            closeRubricPreview();
            
            // Show success message
            alert(`"${currentRubricSelection.text}"이(가) 선택되었습니다.`);
          }

          // Load assignments
          // Print assignment function
          function printAssignment() {
            const assignment = window.currentAssignment;
            if (!assignment) {
              alert('과제 정보를 불러올 수 없습니다.');
              return;
            }

            try {
              const printWindow = window.open('', '_blank', 'width=800,height=600');
              
              // Check if popup was blocked
              if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.\n\n또는 브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여 팝업을 허용해주세요.');
                return;
              }
              
              // Convert Markdown to HTML for prompts
              const promptsHTML = assignment.prompts && assignment.prompts.length > 0 
                ? '<div class="section"><h2>제시문</h2>' +
                  assignment.prompts.map((prompt, idx) => 
                    '<div class="prompt-card"><div class="title">제시문 ' + (idx + 1) + '</div><div class="prose">' + convertMarkdownToHtml(prompt) + '</div></div>'
                  ).join('') + '</div>'
                : '';

            const rubricsHTML = '<div class="section"><h2>평가 루브릭</h2>' +
              assignment.rubrics.map((rubric, idx) => 
                '<div class="rubric-card"><div class="title">' + (idx + 1) + '. ' + rubric.criterion_name + '</div><div class="desc">' + rubric.criterion_description + '</div></div>'
              ).join('') + '</div>';

            const accessCodeHTML = assignment.access_code 
              ? '<div class="access-code-box"><h2 style="margin: 0 0 10px 0; font-size: 20px; color: #92400e;">학생 액세스 코드</h2><div class="access-code">' + assignment.access_code + '</div><p style="font-size: 14px; color: #92400e; margin: 0;">학생들에게 이 코드를 공유하세요</p></div>'
              : '';

            printWindow.document.write(
              '<!DOCTYPE html><html><head>' +
              '<meta charset="UTF-8">' +
              '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
              '<title>' + assignment.title + ' - 인쇄</title>' +
              '<style>' +
              'body { font-family: "Noto Sans KR", Arial, sans-serif; padding: 40px; background: white; line-height: 1.6; max-width: 900px; margin: 0 auto; }' +
              '.print-title { font-size: 28px; font-weight: bold; margin-bottom: 30px; color: #111827; padding-bottom: 15px; border-bottom: 3px solid #1e3a8a; }' +
              '.section { margin-bottom: 30px; }' +
              '.section h2 { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #1e3a8a; }' +
              '.section p { color: #374151; margin: 10px 0; }' +
              '.info-bar { margin-top: 10px; font-size: 14px; color: #6b7280; }' +
              '.prompt-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background: #f9fafb; margin-bottom: 15px; }' +
              '.prompt-card .title { font-weight: 600; color: #1e40af; margin-bottom: 10px; }' +
              '.rubric-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 12px; }' +
              '.rubric-card .title { font-weight: 600; margin-bottom: 8px; }' +
              '.rubric-card .desc { font-size: 14px; color: #6b7280; }' +
              '.access-code-box { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center; }' +
              '.access-code { font-size: 32px; font-weight: bold; font-family: monospace; color: #92400e; margin: 15px 0; }' +
              '.prose { max-width: none; }' +
              '.prose img { max-width: 100%; height: auto; margin: 16px 0; border: 1px solid #e5e7eb; border-radius: 8px; display: block; }' +
              '.prose p { margin: 8px 0; line-height: 1.6; }' +
              '.no-print { margin-top: 40px; display: flex; gap: 16px; justify-content: center; }' +
              '.btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px; }' +
              '.btn-primary { background: #1e3a8a; color: white; }' +
              '.btn-secondary { background: #e5e7eb; color: #374151; }' +
              '@media print { .no-print { display: none; } img { max-width: 100%; page-break-inside: avoid; } }' +
              '</style>' +
              '</head><body>' +
              '<div class="print-title">📝 ' + assignment.title + '</div>' +
              '<div class="section"><h2>과제 설명</h2><p>' + assignment.description + '</p><div class="info-bar">📚 ' + assignment.grade_level + (assignment.due_date ? ' | ⏰ 마감: ' + new Date(assignment.due_date).toLocaleDateString('ko-KR') : '') + '</div></div>' +
              promptsHTML +
              rubricsHTML +
              accessCodeHTML +
              '<div class="no-print">' +
              '<button onclick="window.print()" class="btn btn-primary">🖨️ 인쇄하기</button>' +
              '<button onclick="window.close()" class="btn btn-secondary">닫기</button>' +
              '</div>' +
              '</body></html>'
            );
            printWindow.document.close();
            } catch (error) {
              console.error('Print error:', error);
              alert('출력 중 오류가 발생했습니다: ' + error.message + '\n\n브라우저에서 팝업을 차단했을 수 있습니다. 팝업 허용 후 다시 시도해주세요.');
            }
          }

          async function loadAssignments() {
            console.log('[DEBUG] loadAssignments started');
            console.log('[DEBUG] axios type:', typeof axios);
            console.log('[DEBUG] axios.get type:', typeof axios?.get);
            
            try {
              console.log('[DEBUG] Making GET request to /api/assignments');
              const response = await axios.get('/api/assignments');
              console.log('[DEBUG] Response received:', response.data);
              const assignments = response.data;

              const container = document.getElementById('assignmentsList');

              if (assignments.length === 0) {
                container.innerHTML = `
                  <div class="col-span-full text-center py-12">
                    <i class="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg mb-4">아직 만든 과제가 없습니다.</p>
                    <button onclick="showCreateAssignmentModal()" class="px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition">
                      <i class="fas fa-plus mr-2"></i>첫 과제 만들기
                    </button>
                  </div>
                `;
                return;
              }

              container.innerHTML = assignments.map(assignment => `
                <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition cursor-pointer" onclick="viewAssignment(${assignment.id})">
                  <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold text-gray-900">${assignment.title}</h3>
                    <span class="text-xs bg-navy-100 text-navy-800 px-3 py-1 rounded-full font-semibold">${assignment.grade_level}</span>
                  </div>
                  <p class="text-gray-600 text-sm mb-4 line-clamp-2">${assignment.description}</p>
                  <div class="flex items-center justify-between text-sm text-gray-500">
                    <div>
                      <i class="fas fa-calendar mr-2"></i>
                      ${new Date(assignment.created_at).toLocaleDateString('ko-KR')}
                    </div>
                    ${assignment.due_date ? `
                      <div class="text-orange-600">
                        <i class="fas fa-clock mr-2"></i>
                        마감: ${new Date(assignment.due_date).toLocaleDateString('ko-KR')}
                      </div>
                    ` : ''}
                  </div>
                  <div class="mt-4 pt-4 border-t border-gray-200">
                    <button onclick="event.stopPropagation(); deleteAssignment(${assignment.id})" class="text-red-600 hover:text-red-800 text-sm font-semibold">
                      <i class="fas fa-trash mr-1"></i>삭제
                    </button>
                  </div>
                </div>
              `).join('');
            } catch (error) {
              console.error('Error loading assignments:', error);
              document.getElementById('assignmentsList').innerHTML = `
                <div class="col-span-full text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>과제를 불러오는데 실패했습니다.</p>
                </div>
              `;
            }
          }

          // View assignment detail
          async function viewAssignment(assignmentId) {
            try {
              const response = await axios.get(`/api/assignment/${assignmentId}`);
              const assignment = response.data;
              currentAssignmentId = assignmentId;

              document.getElementById('detailTitle').textContent = assignment.title;

              // Store assignment for printing
              window.currentAssignment = assignment;

              document.getElementById('assignmentDetailContent').innerHTML = `
                <div class="space-y-6">
                  <!-- Top buttons (with library registration) -->
                  <div class="flex justify-end gap-2 mb-4">
                    <button onclick="registerToLibrary(${assignmentId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-sm">
                      <i class="fas fa-bookmark mr-2"></i>라이브러리에 등록하기
                    </button>
                    <button onclick="printAssignment()" class="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition text-sm">
                      <i class="fas fa-print mr-2"></i>출력
                    </button>
                  </div>

                  <!-- Access Code Display -->
                  <div id="accessCodeSection">
                    ${assignment.access_code ? `
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                      <div class="flex items-center justify-between">
                        <div>
                          <h3 class="font-bold text-lg mb-2"><i class="fas fa-key mr-2"></i>학생 접속 코드</h3>
                          <p class="text-blue-100 text-sm">이 코드를 학생들에게 공유하세요</p>
                        </div>
                        <div class="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-8 py-4">
                          <div class="text-4xl font-bold tracking-wider">${assignment.access_code}</div>
                        </div>
                      </div>
                    </div>
                    ` : `
                    <div class="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
                      <div class="flex items-center justify-between">
                        <div>
                          <h3 class="font-bold text-lg mb-2 text-yellow-800"><i class="fas fa-info-circle mr-2"></i>액세스 코드 미생성</h3>
                          <p class="text-yellow-700 text-sm">학생들이 과제에 접근하려면 액세스 코드를 생성하세요</p>
                        </div>
                        <button 
                          onclick="generateAccessCode(${assignmentId})" 
                          class="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition"
                        >
                          <i class="fas fa-key mr-2"></i>액세스 코드 생성
                        </button>
                      </div>
                    </div>
                    `}
                  </div>

                  <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="font-bold text-gray-900 mb-2">과제 설명</h3>
                    <p class="text-gray-700">${assignment.description}</p>
                    <div class="mt-4 flex gap-4 text-sm text-gray-600">
                      <div><i class="fas fa-graduation-cap mr-2"></i>${assignment.grade_level}</div>
                      ${assignment.due_date ? `<div><i class="fas fa-clock mr-2 text-orange-600"></i>마감: ${new Date(assignment.due_date).toLocaleDateString('ko-KR')}</div>` : ''}
                    </div>
                  </div>

                  ${assignment.prompts && assignment.prompts.length > 0 ? `
                  <div class="bg-blue-50 rounded-lg p-6">
                    <h3 class="font-bold text-gray-900 mb-3">제시문</h3>
                    <div class="space-y-3">
                      ${assignment.prompts.map((prompt, idx) => `
                        <div class="bg-white border border-blue-200 rounded-lg p-4">
                          <div class="font-semibold text-blue-900 mb-2">제시문 ${idx + 1}</div>
                          <div class="text-gray-700 prose max-w-none">${convertMarkdownToHtml(prompt)}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                  ` : ''}

                  <div>
                    <h3 class="font-bold text-gray-900 mb-3">평가 루브릭 (${assignment.rubrics.length}개 기준)</h3>
                    <div class="space-y-2">
                      ${assignment.rubrics.map((rubric, idx) => `
                        <div class="border border-gray-200 rounded-lg p-4 bg-white">
                          <div class="font-semibold text-gray-900">${idx + 1}. ${rubric.criterion_name}</div>
                          <div class="text-sm text-gray-600 mt-1">${rubric.criterion_description}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <div>
                    <div class="flex justify-between items-center mb-3">
                      <h3 class="font-bold text-gray-900">학생 제출물 (${assignment.submissions.length}개)</h3>
                      <button onclick="showAddSubmissionForm()" class="px-4 py-2 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition text-sm">
                        <i class="fas fa-upload mr-2"></i>답안지 추가
                      </button>
                    </div>

                    <div id="submissionsList">
                      ${assignment.submissions.length === 0 ? 
                        '<p class="text-gray-500 text-center py-8">아직 제출된 답안지가 없습니다.</p>' :
                        '<div class="space-y-3">' +
                          assignment.submissions.map(submission => 
                            '<div class="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition">' +
                              '<div class="flex justify-between items-start">' +
                                '<div class="flex-1">' +
                                  '<div class="font-semibold text-gray-900">' + submission.student_name + '</div>' +
                                  '<div class="text-sm text-gray-600 mt-1">' + submission.essay_text.substring(0, 100) + '...</div>' +
                                  '<div class="text-xs text-gray-500 mt-2">' +
                                    '<i class="fas fa-clock mr-1"></i>' +
                                    new Date(submission.submitted_at).toLocaleString('ko-KR') +
                                  '</div>' +
                                '</div>' +
                                '<div class="ml-4">' +
                                  (submission.status === 'graded' || submission.graded ? 
                                    '<span class="text-green-600 font-semibold text-sm"><i class="fas fa-check-circle mr-1"></i>채점완료</span>' :
                                    '<button onclick="gradeSubmission(' + submission.id + ')" class="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 transition">채점하기</button>'
                                  ) +
                                '</div>' +
                              '</div>' +
                            '</div>'
                          ).join('') +
                        '</div>'
                      }
                    </div>

                    <div id="addSubmissionForm" class="hidden mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <h4 class="font-semibold text-gray-900 mb-4">새 답안지 추가</h4>
                      <form onsubmit="handleAddSubmission(event)">
                        <div class="space-y-3">
                          <div id="studentNameContainer">
                            <input type="text" id="studentName" placeholder="학생 이름" class="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                          </div>
                          
                          <!-- Essay Input Type Tabs -->
                          <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">답안 입력 방식</label>
                            <div class="flex gap-2 mb-3">
                              <button 
                                type="button" 
                                id="submissionTextInputBtn"
                                onclick="switchSubmissionInputType('text')" 
                                class="submission-input-tab flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 text-sm font-semibold transition active bg-navy-900 text-white border-navy-900"
                              >
                                <i class="fas fa-keyboard mr-2"></i>텍스트 입력
                              </button>
                              <button 
                                type="button" 
                                id="submissionFileInputBtn"
                                onclick="switchSubmissionInputType('file')" 
                                class="submission-input-tab flex-1 px-4 py-2 rounded-lg border-2 border-gray-300 text-sm font-semibold transition"
                              >
                                <i class="fas fa-file-upload mr-2"></i>파일 선택
                              </button>
                            </div>
                          </div>
                          
                          <!-- Text Input Container -->
                          <div id="submissionTextInputContainer">
                            <textarea id="studentEssay" rows="6" placeholder="학생 논술 내용을 입력하세요" class="w-full px-4 py-2 border border-gray-300 rounded-lg" required></textarea>
                          </div>
                          
                          <!-- File Input Container -->
                          <div id="submissionFileInputContainer" class="hidden">
                            <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-navy-500 transition">
                              <input 
                                type="file" 
                                id="submissionEssayFile" 
                                accept="image/*,.pdf"
                                class="hidden"
                                multiple
                                onchange="handleSubmissionFileSelect(event)"
                              />
                              <label for="submissionEssayFile" class="cursor-pointer">
                                <div class="mb-3">
                                  <i class="fas fa-cloud-upload-alt text-5xl text-navy-700"></i>
                                </div>
                                <p class="text-base font-semibold text-gray-700 mb-2">파일을 선택하거나 드래그하세요 (여러 파일 선택 가능)</p>
                                <p class="text-sm text-gray-500 mb-3">
                                  지원 형식: 이미지 (JPG, PNG), PDF (최대 10MB/파일)<br>
                                  <span class="text-navy-700 font-medium">파일명 형식: 학생이름.pdf 또는 학생이름_답안.pdf</span>
                                </p>
                                <span class="inline-block bg-navy-900 text-white px-6 py-2 rounded-lg font-semibold hover:bg-navy-800 transition">
                                  <i class="fas fa-folder-open mr-2"></i>파일 찾기 (여러 개 선택 가능)
                                </span>
                              </label>
                            </div>
                            
                            <!-- Multiple Files List -->
                            <div id="multipleFilesContainer" class="hidden mt-4">
                              <div class="flex justify-between items-center mb-3">
                                <h4 class="font-semibold text-gray-900">선택된 파일 (<span id="fileCount">0</span>개)</h4>
                                <button type="button" onclick="clearAllFiles()" class="text-sm text-red-600 hover:text-red-800">
                                  <i class="fas fa-trash mr-1"></i>전체 삭제
                                </button>
                              </div>
                              <div id="filesList" class="space-y-2 max-h-96 overflow-y-auto">
                                <!-- File items will be added here -->
                              </div>
                            </div>
                            
                            <!-- File Preview (Legacy - for single file mode) -->
                            <div id="submissionFilePreview" class="hidden mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                  <i class="fas fa-file-alt text-3xl text-navy-700 mr-3"></i>
                                  <div>
                                    <p id="submissionFileName" class="font-semibold text-gray-800"></p>
                                    <p id="submissionFileSize" class="text-sm text-gray-500"></p>
                                  </div>
                                </div>
                                <button 
                                  type="button" 
                                  onclick="clearSubmissionFile()" 
                                  class="text-red-500 hover:text-red-700"
                                >
                                  <i class="fas fa-times-circle text-2xl"></i>
                                </button>
                              </div>
                              <!-- Image preview -->
                              <div id="submissionImagePreview" class="hidden mt-3">
                                <img id="submissionPreviewImg" src="" alt="Preview" class="max-w-full h-auto rounded-lg border border-gray-300" />
                              </div>
                            </div>
                          </div>
                          
                          <div class="flex gap-2">
                            <button type="submit" class="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition">추가</button>
                            <button type="button" onclick="hideAddSubmissionForm()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">취소</button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>

                  <!-- Bottom action buttons -->
                  <div class="sticky bottom-0 bg-white border-t-2 border-gray-200 pt-4 mt-6 flex justify-end gap-3">
                    <button onclick="closeAssignmentDetailModal()" class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">
                      <i class="fas fa-times mr-2"></i>닫기
                    </button>
                    <button onclick="printAssignment()" class="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition">
                      <i class="fas fa-print mr-2"></i>출력
                    </button>
                  </div>
                </div>
              `;

              document.getElementById('assignmentDetailModal').classList.remove('hidden');
            } catch (error) {
              console.error('Error loading assignment:', error);
              alert('과제를 불러오는데 실패했습니다.');
            }
          }

          // Grading Settings Modal
          let currentSubmissionIdForGrading = null;
          
          function showGradingSettingsModal(submissionId) {
            console.log('showGradingSettingsModal called with:', submissionId, 'Type:', typeof submissionId);
            
            // Remove any existing modal first
            const existingModal = document.getElementById('gradingSettingsModal');
            if (existingModal) {
              existingModal.remove();
            }
            
            // Store submission ID
            currentSubmissionIdForGrading = submissionId;
            console.log('currentSubmissionIdForGrading set to:', currentSubmissionIdForGrading);
            
            const modalHTML = `
              <div id="gradingSettingsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                  <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">
                      <i class="fas fa-sliders-h text-navy-700 mr-2"></i>
                      채점 설정
                    </h2>
                    <button onclick="closeGradingSettingsModal()" class="text-gray-400 hover:text-gray-600">
                      <i class="fas fa-times text-2xl"></i>
                    </button>
                  </div>
                  
                  <div class="space-y-6">
                    <!-- Feedback Detail Level -->
                    <div>
                      <label class="block text-sm font-semibold text-gray-700 mb-3">
                        <i class="fas fa-list-ul text-navy-700 mr-2"></i>
                        피드백 세부 수준
                      </label>
                      <div class="grid grid-cols-3 gap-3">
                        <button 
                          type="button"
                          onclick="selectFeedbackLevel('detailed')"
                          class="feedback-level-btn px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:border-navy-500 transition active"
                          data-level="detailed"
                        >
                          <i class="fas fa-align-justify mb-1"></i>
                          <div>상세하게</div>
                        </button>
                        <button 
                          type="button"
                          onclick="selectFeedbackLevel('moderate')"
                          class="feedback-level-btn px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:border-navy-500 transition"
                          data-level="moderate"
                        >
                          <i class="fas fa-align-left mb-1"></i>
                          <div>중간</div>
                        </button>
                        <button 
                          type="button"
                          onclick="selectFeedbackLevel('brief')"
                          class="feedback-level-btn px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:border-navy-500 transition"
                          data-level="brief"
                        >
                          <i class="fas fa-minus mb-1"></i>
                          <div>간략하게</div>
                        </button>
                      </div>
                      <p class="text-xs text-gray-500 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        피드백의 상세함 정도를 선택하세요
                      </p>
                    </div>
                    
                    <!-- Grading Strictness -->
                    <div>
                      <label class="block text-sm font-semibold text-gray-700 mb-3">
                        <i class="fas fa-balance-scale text-navy-700 mr-2"></i>
                        채점 강도
                      </label>
                      <div class="grid grid-cols-3 gap-3">
                        <button 
                          type="button"
                          onclick="selectGradingStrictness('lenient')"
                          class="grading-strictness-btn px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:border-navy-500 transition"
                          data-strictness="lenient"
                        >
                          <i class="fas fa-smile mb-1"></i>
                          <div>관대하게</div>
                        </button>
                        <button 
                          type="button"
                          onclick="selectGradingStrictness('moderate')"
                          class="grading-strictness-btn px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:border-navy-500 transition active"
                          data-strictness="moderate"
                        >
                          <i class="fas fa-meh mb-1"></i>
                          <div>보통</div>
                        </button>
                        <button 
                          type="button"
                          onclick="selectGradingStrictness('strict')"
                          class="grading-strictness-btn px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-semibold hover:border-navy-500 transition"
                          data-strictness="strict"
                        >
                          <i class="fas fa-frown mb-1"></i>
                          <div>엄격하게</div>
                        </button>
                      </div>
                      <p class="text-xs text-gray-500 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        채점 기준의 엄격함 정도를 선택하세요
                      </p>
                    </div>
                  </div>
                  
                  <div class="flex gap-3 mt-8">
                    <button 
                      onclick="confirmGradingSettings()" 
                      class="flex-1 px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition"
                    >
                      <i class="fas fa-check mr-2"></i>채점 시작
                    </button>
                    <button 
                      onclick="closeGradingSettingsModal()" 
                      class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
          }
          
          function selectFeedbackLevel(level) {
            const buttons = document.querySelectorAll('.feedback-level-btn');
            buttons.forEach(btn => {
              if (btn.dataset.level === level) {
                btn.classList.add('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              } else {
                btn.classList.remove('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              }
            });
          }
          
          function selectGradingStrictness(strictness) {
            const buttons = document.querySelectorAll('.grading-strictness-btn');
            buttons.forEach(btn => {
              if (btn.dataset.strictness === strictness) {
                btn.classList.add('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              } else {
                btn.classList.remove('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              }
            });
          }
          
          function closeGradingSettingsModal() {
            const modal = document.getElementById('gradingSettingsModal');
            if (modal) {
              modal.remove();
            }
            currentSubmissionIdForGrading = null;
          }
          
          async function confirmGradingSettings() {
            // Get selected settings
            const feedbackLevelBtn = document.querySelector('.feedback-level-btn.active');
            const strictnessBtn = document.querySelector('.grading-strictness-btn.active');
            
            const feedbackLevel = feedbackLevelBtn ? feedbackLevelBtn.dataset.level : 'detailed';
            const strictness = strictnessBtn ? strictnessBtn.dataset.strictness : 'moderate';
            
            // IMPORTANT: Store submission ID in local variable BEFORE closing modal
            // because closeGradingSettingsModal sets currentSubmissionIdForGrading to null
            const submissionId = currentSubmissionIdForGrading;
            
            console.log('Grading Settings:', {
              submissionId: submissionId,
              feedbackLevel,
              strictness
            });
            
            // Validate submission ID
            if (!submissionId) {
              alert('채점할 답안지를 찾을 수 없습니다.');
              closeGradingSettingsModal();
              return;
            }
            
            // Close settings modal (this will set currentSubmissionIdForGrading to null)
            closeGradingSettingsModal();
            
            // Show loading modal for regrading
            showGradingLoadingModal();
            
            // Start grading with settings using the stored local variable
            await executeGradingWithLoading(submissionId, feedbackLevel, strictness);
          }
          
          // Expose functions to window object for onclick handlers
          window.gradeSubmission = gradeSubmission;
          window.showGradingSettingsModal = showGradingSettingsModal;
          window.selectFeedbackLevel = selectFeedbackLevel;
          window.selectGradingStrictness = selectGradingStrictness;
          window.closeGradingSettingsModal = closeGradingSettingsModal;
          window.confirmGradingSettings = confirmGradingSettings;
          window.togglePrintDropdown = togglePrintDropdown;
          window.printReport = printReport;
          window.exportToPDF = exportToPDF;
          window.regradeSubmission = regradeSubmission;
          window.previewRubric = previewRubric;
          window.closeRubricPreview = closeRubricPreview;
          window.selectCurrentRubric = selectCurrentRubric;
          window.updateStudentName = updateStudentName;
          window.removeFile = removeFile;
          window.clearAllFiles = clearAllFiles;

          // Platform rubric definitions
          function getPlatformRubricCriteria(type) {
            const rubrics = {
              standard: [
                { name: '핵심 개념의 이해와 분석', description: '논제를 정확하게 파악하고 깊이 있게 분석했습니다.', order: 1, max_score: 4 },
                { name: '증거와 사례 활용', description: '논거가 논리적이고 설득력이 있습니다.', order: 2, max_score: 4 },
                { name: '출처 인용의 정확성', description: '구체적이고 적절한 사례를 효과적으로 활용했습니다.', order: 3, max_score: 4 },
                { name: '문법 정확성, 구성 및 흐름', description: '문법, 어휘, 문장 구조가 정확하고 적절합니다.', order: 4, max_score: 4 }
              ],
              kr_elementary: [
                { name: '내용의 풍부성', description: '자기 생각이나 느낌, 경험을 솔직하고 구체적으로 표현했습니다.', order: 1, max_score: 40 },
                { name: '글의 짜임', description: '처음부터 끝까지 자연스럽게 글이 흘러갑니다.', order: 2, max_score: 30 },
                { name: '표현과 맞춤법', description: '문장이 자연스럽고, 맞춤법과 띄어쓰기가 바릅니다.', order: 3, max_score: 30 }
              ],
              kr_middle: [
                { name: '주제의 명료성', description: '글쓴이의 주장이나 주제가 분명하게 드러나는지 평가합니다.', order: 1, max_score: 20 },
                { name: '논리적 구성', description: '서론(도입)-본론(전개)-결론(정리)의 형식을 갖추고 문단이 잘 구분되었는지 평가합니다.', order: 2, max_score: 30 },
                { name: '근거의 적절성', description: '주장을 뒷받침하기 위해 적절한 이유나 예시를 들었는지 평가합니다.', order: 3, max_score: 30 },
                { name: '표현의 정확성', description: '표준어 사용, 맞춤법, 문장의 호응 등 기본적인 국어 사용 능력을 평가합니다.', order: 4, max_score: 20 }
              ],
              kr_high: [
                { name: '통찰력 및 비판적 사고', description: '주제를 단순히 나열하지 않고, 자신만의 관점으로 심도 있게 분석하거나 비판적으로 고찰했습니다.', order: 1, max_score: 30 },
                { name: '논증의 체계성', description: '논지가 유기적으로 연결되며, 예상되는 반론을 고려하거나 논리적 완결성을 갖추었습니다.', order: 2, max_score: 30 },
                { name: '근거의 타당성 및 다양성', description: '객관적 자료, 전문가 견해 등 신뢰할 수 있는 근거를 활용하여 설등력을 높였습니다.', order: 3, max_score: 25 },
                { name: '문체 및 어법의 세련됨', description: '학술적 글쓰기에 적합한 어조와 세련된 문장 구사력을 보여줍니다.', order: 4, max_score: 15 }
              ],
              nyregents: [
                { name: '내용과 분석 (주장 제시)', description: '구체적인 주장을 제시하고, 자료와 주제를 적절히 분석하며, 반론을 평가합니다.', order: 1, max_score: 4 },
                { name: '증거 활용 능력', description: '관련 증거를 활용하여 충분하고 적절한 근거를 제시하며, 표절을 피하고 허용 가능한 인용 형식을 사용합니다.', order: 2, max_score: 4 },
                { name: '일관성과 구성', description: '과제에 대한 수용 가능한 집중도를 유지하고, 체계적이고 논리적인 구조로 글을 구성합니다.', order: 3, max_score: 4 },
                { name: '언어 사용과 규칙', description: '적절한 어휘와 문장 구조를 사용하며, 문법과 맞춤법 규칙을 준수합니다.', order: 4, max_score: 4 }
              ],
              nyregents_analytical: [
                { name: '내용 및 분석', description: '4점: 분석 기준을 명확히 설정하는 논리적인 중심 아이디어와 글쓰기 전략을 제시하고, 저자가 중심 아이디어를 전개하기 위해 글쓰기 전략을 사용한 방식을 깊이 있게 분석합니다.', order: 1, max_score: 4 },
                { name: '증거 활용 능력', description: '4점: 분석을 뒷받침하기 위해 구체적이고 관련성 있는 증거를 효과적으로 활용하여 아이디어를 명확하고 일관되게 제시합니다.', order: 2, max_score: 4 },
                { name: '일관성, 구성 및 스타일', description: '4점: 아이디어와 정보를 논리적으로 구성하여 일관되고 연결된 응답을 생성하며, 정확한 언어와 건전한 구조를 사용하여 형식적인 스타일을 확립하고 유지합니다.', order: 3, max_score: 4 },
                { name: '규칙 숙달도', description: '4점: 표준어 문법, 용법, 구두점, 철자법의 규칙 숙달도가 뛰어나며 오류가 드물게 나타납니다.', order: 4, max_score: 4 }
              ],
              ny_middle: [
                { name: '내용 및 분석', description: '4점: 과제의 목적과 논리적으로 연결되는 방식으로 주제를 설득력 있게 명확히 제시하며, 텍스트에 대한 통찰력 있는 분석을 보여줍니다.', order: 1, max_score: 4 },
                { name: '증거 활용 능력', description: '4점: 주제와 관련된 잘 선택된 사실, 정의, 구체적인 세부 사항, 인용문 또는 텍스트의 다른 정보와 예시를 활용하여 주제를 전개하며, 다양하고 관련성 있는 증거를 지속적으로 사용합니다.', order: 2, max_score: 4 },
                { name: '일관성, 구성 및 문체', description: '4점: 적절한 다양한 전환을 능숙하게 사용하여 통일된 전체를 만들고 의미를 강화하는 명확한 구성을 보여주며, 학년에 적합하고 문체적으로 정교한 언어를 사용하여 뚜렷한 어조를 유지하고 형식적인 문체를 확립합니다.', order: 3, max_score: 4 },
                { name: '규칙 준수', description: '4점: 학년 수준에 맞는 규칙 숙달도를 보여주며 오류가 거의 없습니다.', order: 4, max_score: 4 }
              ],
              ny_elementary: [
                { name: '내용 및 분석', description: '4점: 과제와 목적에 논리적으로 부합하는 방식으로 주제를 명확히 제시하며, 텍스트에 대한 통찰력 있는 이해와 분석을 보여줍니다.', order: 1, max_score: 4 },
                { name: '증거 활용 능력', description: '4점: 텍스트에서 관련성 있고 잘 선택된 사실, 정의, 구체적 세부사항, 인용문 또는 기타 정보와 예시를 활용하여 주제를 전개하며, 다양하고 관련성 있는 증거의 사용을 지속합니다.', order: 2, max_score: 4 },
                { name: '일관성, 구성 및 문체', description: '4점: 명확하고 목적에 부합하는 구성을 보여주며, 학년 수준에 맞는 단어와 구문을 사용하여 아이디어를 능숙하게 연결하고, 학년 수준에 맞는 문체적으로 정교한 언어와 분야별 전문 용어를 사용합니다.', order: 3, max_score: 4 },
                { name: '규칙 준수', description: '4점: 학년 수준에 맞는 규칙 숙달도를 보여주며 오류가 거의 없습니다.', order: 4, max_score: 4 }
              ],
              ib_myp_highschool: [
                { name: '지식과 이해', description: '4점: 과학적 지식을 개괄적으로 설명하고, 익숙한 상황과 익숙하지 않은 상황 모두에서 문제 해결 및 해결책을 제안하며, 정보를 해석하여 과학적으로 뒷받침되는 판단을 내릴 수 있습니다.', order: 1, max_score: 4 },
                { name: '조사', description: '4점: 검증 가능한 문제를 개요로 제시하고, 과학적 추론을 사용하여 예측을 제시하며, 충분하고 관련성 있는 데이터를 수집하는 방법과 변수 조작 방법을 개요로 제시하고, 논리적이고 완전하며 안전한 방법을 설계할 수 있습니다.', order: 2, max_score: 4 },
                { name: '의사 소통', description: '4점: 항상 명확하고 적절한 방식으로 정보와 아이디어를 전달하며, 명확하고 논리적인 구조로 효과적으로 구성하고, 적절한 관례를 사용하여 정보 출처를 일관되게 제시합니다.', order: 3, max_score: 4 },
                { name: '비판적 사고', description: '4점: 다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시할 수 있습니다.', order: 4, max_score: 4 }
              ],
              ib_myp_middleschool: [
                { name: '지식과 이해', description: '4점: 과학적 지식을 개괄적으로 설명하고, 익숙한 상황과 익숙하지 않은 상황 모두에서 문제 해결 및 해결책을 제안하며, 정보를 해석하여 과학적으로 뒷받침되는 판단을 내릴 수 있습니다.', order: 1, max_score: 4 },
                { name: '조사', description: '4점: 검증 가능한 문제를 개요로 제시하고, 과학적 추론을 사용하여 예측을 제시하며, 충분하고 관련성 있는 데이터를 수집하는 방법과 변수 조작 방법을 개요로 제시하고, 논리적이고 완전하며 안전한 방법을 설계할 수 있습니다.', order: 2, max_score: 4 },
                { name: '의사 소통', description: '4점: 항상 명확하고 적절한 방식으로 정보와 아이디어를 전달하며, 명확하고 논리적인 구조로 효과적으로 구성하고, 적절한 관례를 사용하여 정보 출처를 일관되게 제시합니다.', order: 3, max_score: 4 },
                { name: '비판적 사고', description: '4점: 다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시할 수 있습니다.', order: 4, max_score: 4 }
              ],
              ib_myp_science: [
                { name: '지식과 이해', description: '4점: 과학적 지식을 개괄적으로 설명하고, 익숙한 상황과 익숙하지 않은 상황 모두에서 문제 해결 및 해결책을 제안하며, 정보를 해석하여 과학적으로 뒷받침되는 판단을 내릴 수 있습니다.', order: 1, max_score: 4 },
                { name: '탐구 및 설계', description: '4점: 검증 가능한 문제를 개요로 제시하고, 과학적 추론을 사용하여 예측을 제시하며, 충분하고 관련성 있는 데이터를 수집하는 방법과 변수 조작 방법을 개요로 제시하고, 논리적이고 완전하며 안전한 방법을 설계할 수 있습니다.', order: 2, max_score: 4 },
                { name: '의사 소통', description: '4점: 항상 명확하고 적절한 방식으로 정보와 아이디어를 전달하며, 명확하고 논리적인 구조로 효과적으로 구성하고, 적절한 관례를 사용하여 정보 출처를 일관되게 제시합니다.', order: 3, max_score: 4 },
                { name: '비판적 사고', description: '4점: 다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시할 수 있습니다.', order: 4, max_score: 4 }
              ]
            };
            return rubrics[type] || rubrics.standard;
          }

          // Rubric type switching for assignment creation
          function switchAssignmentRubricType(type) {
            const platformBtn = document.getElementById('assignmentPlatformRubricBtn');
            const customBtn = document.getElementById('assignmentCustomRubricBtn');
            const platformContainer = document.getElementById('assignmentPlatformRubricContainer');
            const customContainer = document.getElementById('assignmentCustomRubricContainer');

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
              
              // Add 4 default criteria if rubric container is empty
              const rubricContainer = document.getElementById('rubricCriteriaList');
              if (rubricContainer && rubricContainer.children.length === 0) {
                for (let i = 0; i < 4; i++) {
                  addRubricCriterion();
                }
              }
            }
          }

          // Show/hide modals
          async function showCreateAssignmentModal() {
            document.getElementById('createAssignmentModal').classList.remove('hidden');
            // Default to platform rubric
            switchAssignmentRubricType('platform');
            
            // Load existing assignments for the dropdown
            await populateExistingAssignments();
          }
          
          // Populate existing assignments dropdown
          async function populateExistingAssignments() {
            try {
              const response = await axios.get('/api/assignments');
              const assignments = response.data;
              
              const select = document.getElementById('existingAssignmentSelect');
              // Clear existing options except the first one
              select.innerHTML = '<option value="">-- 기존 과제를 선택하세요 --</option>';
              
              assignments.forEach(assignment => {
                const option = document.createElement('option');
                option.value = assignment.id;
                option.textContent = `${assignment.title} (${new Date(assignment.created_at).toLocaleDateString('ko-KR')})`;
                select.appendChild(option);
              });
              
              console.log('Loaded', assignments.length, 'existing assignments');
            } catch (error) {
              console.error('Error loading existing assignments:', error);
            }
          }
          
          // Load existing assignment data
          async function loadExistingAssignment() {
            const select = document.getElementById('existingAssignmentSelect');
            const assignmentId = select.value;
            
            if (!assignmentId) {
              alert('과제를 선택해주세요.');
              return;
            }
            
            try {
              const response = await axios.get(`/api/assignment/${assignmentId}`);
              const assignment = response.data;
              
              console.log('Loading assignment:', assignment);
              
              // Fill in the form with existing assignment data
              document.getElementById('assignmentTitle').value = assignment.title + ' (복사본)';
              document.getElementById('assignmentDescription').value = assignment.description || '';
              document.getElementById('assignmentGradeLevel').value = assignment.grade_level || '';
              document.getElementById('assignmentDueDate').value = assignment.due_date ? assignment.due_date.split('T')[0] : '';
              
              // Load reference materials (prompts)
              // Handle both string and already-parsed array
              let prompts = assignment.prompts;
              if (typeof prompts === 'string') {
                try {
                  prompts = JSON.parse(prompts);
                } catch (e) {
                  console.error('Failed to parse prompts:', e);
                  prompts = [];
                }
              } else if (!Array.isArray(prompts)) {
                prompts = [];
              }
              
              const container = document.getElementById('assignmentReferenceMaterials');
              container.innerHTML = '';
              
              console.log('Loaded prompts:', prompts);
              
              // Add reference materials
              prompts.forEach((prompt, index) => {
                // Handle both string and object formats
                const promptText = typeof prompt === 'string' ? prompt : (prompt.text || '');
                const promptImageUrl = typeof prompt === 'object' ? prompt.image_url : '';
                
                console.log(`Prompt ${index}:`, { promptText: promptText.substring(0, 50), promptImageUrl });
                
                const refItem = document.createElement('div');
                refItem.className = 'reference-item';
                refItem.innerHTML = `
                  <div class="flex gap-2 mb-2">
                    <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)">${promptText}</textarea>
                    <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                  <div class="flex gap-2">
                    <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                      <i class="fas fa-image mr-1"></i>이미지 업로드
                    </button>
                    <span class="text-xs text-gray-500 self-center upload-status">${promptImageUrl ? '이미지 업로드됨' : ''}</span>
                  </div>
                `;
                container.appendChild(refItem);
                
                // Store image URL if exists
                if (promptImageUrl) {
                  const textarea = refItem.querySelector('textarea');
                  textarea.dataset.imageUrl = promptImageUrl;
                }
              });
              
              // If no prompts, add 4 empty slots
              if (prompts.length === 0) {
                for (let i = 0; i < 4; i++) {
                  addReferenceMaterial();
                }
              }
              
              // Update reference count
              updateReferenceCount();
              
              // Load rubric criteria
              // Handle both string and already-parsed array
              let criteria = assignment.rubric_criteria;
              if (typeof criteria === 'string') {
                try {
                  criteria = JSON.parse(criteria);
                } catch (e) {
                  console.error('Failed to parse rubric_criteria:', e);
                  criteria = [];
                }
              } else if (!Array.isArray(criteria)) {
                criteria = [];
              }
              
              const rubricType = assignment.rubric_type || 'platform';
              
              switchAssignmentRubricType(rubricType);
              
              if (rubricType === 'custom') {
                const criteriaList = document.getElementById('rubricCriteriaList');
                criteriaList.innerHTML = '';
                criterionCounter = 0;
                
                criteria.forEach(criterion => {
                  addRubricCriterion();
                  const lastCriterion = criteriaList.lastElementChild;
                  lastCriterion.querySelector('input[type="text"]').value = criterion.name;
                  lastCriterion.querySelector('textarea').value = criterion.description || '';
                });
              }
              
              console.log('Assignment loaded successfully!');
              alert(`과제를 성공적으로 불러왔습니다!\n제목: ${assignment.title}\n제시문 수: ${prompts.length}개\n\n내용을 편집하여 사용하세요.`);
              
            } catch (error) {
              console.error('Error loading assignment:', error);
              alert(`과제를 불러오는데 실패했습니다.\n오류: ${error.response?.data?.error || error.message}`);
            }
          }

          function closeCreateAssignmentModal() {
            document.getElementById('createAssignmentModal').classList.add('hidden');
            document.getElementById('createAssignmentForm').reset();
            document.getElementById('rubricCriteriaList').innerHTML = '';
            criterionCounter = 0;
            
            // Reset rubric type to platform
            switchAssignmentRubricType('platform');
            
            // Reset reference materials to 4 default slots WITH CHECKBOXES AND PREVIEW
            const container = document.getElementById('assignmentReferenceMaterials');
            container.innerHTML = `
              <div class="reference-item">
                <div class="flex gap-2 mb-2">
                  <div class="flex-1">
                    <textarea class="reference-input w-full px-3 py-2 border border-gray-300 rounded-t-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)" oninput="updateReferencePreview(this)"></textarea>
                    <div class="reference-preview border border-t-0 border-gray-300 rounded-b-lg px-3 py-2 text-sm bg-gray-50 min-h-[100px] overflow-y-auto" style="display:none;">
                      <p class="text-gray-400 text-xs">미리보기가 여기에 표시됩니다</p>
                    </div>
                  </div>
                  <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="flex gap-3 items-center">
                  <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                    <i class="fas fa-image mr-1"></i>이미지 업로드
                  </button>
                  <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                    <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                  </label>
                  <button type="button" onclick="toggleReferencePreview(this)" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs">
                    <i class="fas fa-eye mr-1"></i>미리보기
                  </button>
                  <span class="text-xs text-gray-500 self-center upload-status"></span>
                </div>
              </div>
              <div class="reference-item">
                <div class="flex gap-2 mb-2">
                  <div class="flex-1">
                    <textarea class="reference-input w-full px-3 py-2 border border-gray-300 rounded-t-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)" oninput="updateReferencePreview(this)"></textarea>
                    <div class="reference-preview border border-t-0 border-gray-300 rounded-b-lg px-3 py-2 text-sm bg-gray-50 min-h-[100px] overflow-y-auto" style="display:none;">
                      <p class="text-gray-400 text-xs">미리보기가 여기에 표시됩니다</p>
                    </div>
                  </div>
                  <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="flex gap-3 items-center">
                  <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                    <i class="fas fa-image mr-1"></i>이미지 업로드
                  </button>
                  <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                    <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                  </label>
                  <button type="button" onclick="toggleReferencePreview(this)" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs">
                    <i class="fas fa-eye mr-1"></i>미리보기
                  </button>
                  <span class="text-xs text-gray-500 self-center upload-status"></span>
                </div>
              </div>
              <div class="reference-item">
                <div class="flex gap-2 mb-2">
                  <div class="flex-1">
                    <textarea class="reference-input w-full px-3 py-2 border border-gray-300 rounded-t-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)" oninput="updateReferencePreview(this)"></textarea>
                    <div class="reference-preview border border-t-0 border-gray-300 rounded-b-lg px-3 py-2 text-sm bg-gray-50 min-h-[100px] overflow-y-auto" style="display:none;">
                      <p class="text-gray-400 text-xs">미리보기가 여기에 표시됩니다</p>
                    </div>
                  </div>
                  <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="flex gap-3 items-center">
                  <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                    <i class="fas fa-image mr-1"></i>이미지 업로드
                  </button>
                  <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                    <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                  </label>
                  <button type="button" onclick="toggleReferencePreview(this)" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs">
                    <i class="fas fa-eye mr-1"></i>미리보기
                  </button>
                  <span class="text-xs text-gray-500 self-center upload-status"></span>
                </div>
              </div>
              <div class="reference-item">
                <div class="flex gap-2 mb-2">
                  <div class="flex-1">
                    <textarea class="reference-input w-full px-3 py-2 border border-gray-300 rounded-t-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)" oninput="updateReferencePreview(this)"></textarea>
                    <div class="reference-preview border border-t-0 border-gray-300 rounded-b-lg px-3 py-2 text-sm bg-gray-50 min-h-[100px] overflow-y-auto" style="display:none;">
                      <p class="text-gray-400 text-xs">미리보기가 여기에 표시됩니다</p>
                    </div>
                  </div>
                  <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="flex gap-3 items-center">
                  <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                    <i class="fas fa-image mr-1"></i>이미지 업로드
                  </button>
                  <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                    <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                    <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                  </label>
                  <button type="button" onclick="toggleReferencePreview(this)" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs">
                    <i class="fas fa-eye mr-1"></i>미리보기
                  </button>
                  <span class="text-xs text-gray-500 self-center upload-status"></span>
                </div>
              </div>
            `;
            updateReferenceCount();
          }

          function closeAssignmentDetailModal() {
            document.getElementById('assignmentDetailModal').classList.add('hidden');
            currentAssignmentId = null;
          }

          // Generate access code for assignment
          async function generateAccessCode(assignmentId) {
            try {
              const confirmed = confirm('이 과제의 액세스 코드를 생성하시겠습니까?');
              if (!confirmed) return;

              const response = await axios.post(`/api/assignment/${assignmentId}/generate-access-code`);
              
              if (response.data.success || response.data.access_code) {
                const accessCode = response.data.access_code;
                
                // Update the access code section in the UI
                const accessCodeSection = document.getElementById('accessCodeSection');
                if (accessCodeSection) {
                  accessCodeSection.innerHTML = `
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                      <div class="flex items-center justify-between">
                        <div>
                          <h3 class="font-bold text-lg mb-2"><i class="fas fa-key mr-2"></i>학생 접속 코드</h3>
                          <p class="text-blue-100 text-sm">이 코드를 학생들에게 공유하세요</p>
                        </div>
                        <div class="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-8 py-4">
                          <div class="text-4xl font-bold tracking-wider">${accessCode}</div>
                        </div>
                      </div>
                    </div>
                  `;
                }
                
                alert('액세스 코드가 생성되었습니다: ' + accessCode);
              } else {
                alert('액세스 코드 생성에 실패했습니다.');
              }
            } catch (error) {
              console.error('Error generating access code:', error);
              alert('액세스 코드 생성 중 오류가 발생했습니다.');
            }
          }

          // Add rubric criterion
          function addRubricCriterion() {
            criterionCounter++;
            const container = document.getElementById('rubricCriteriaList');
            const div = document.createElement('div');
            div.className = 'border border-gray-200 rounded-lg p-3 bg-white';
            div.id = `criterion-${criterionCounter}`;
            
            // Define placeholders for each criterion
            const placeholders = [
              { name: '기준 이름(예: 핵심 개념의 이해와 분석)', description: '기준 설명(예: 제2차 세계대전의 주요 원인을 정확하게 파악하고 깊이 있게 분석합니다.)' },
              { name: '기준 이름(예: 증거와 역사적 사례 활용)', description: '기준 설명(예: 논거를 뒷받침하기 위해 구체적이고 적절한 역사적 사례를 사용합니다.)' },
              { name: '기준 이름(예: 출처 인용의 정확성)', description: '기준 설명(예: 지정된 자료에서 정보를 정확하게 최소 두 번 인용합니다.)' },
              { name: '기준 이름(예: 문법 정확성, 구성 및 흐름)', description: '기준 설명(예: 최소한의 문법 오류, 논리적 흐름, 다양한 문장 구조를 보여줍니다.)' }
            ];
            
            const placeholder = placeholders[(criterionCounter - 1) % 4];
            
            div.innerHTML = `
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-gray-600">기준 ${criterionCounter}</span>
                <button type="button" onclick="removeCriterion(${criterionCounter})" class="text-red-500 hover:text-red-700 text-xs">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <input type="text" class="criterion-name w-full px-3 py-2 border border-gray-200 rounded mb-2 text-sm placeholder-gray-400" placeholder="${placeholder.name}" required>
              <textarea class="criterion-description w-full px-3 py-2 border border-gray-200 rounded mb-2 text-sm placeholder-gray-400" rows="2" placeholder="${placeholder.description}" required></textarea>
              <div class="flex items-center gap-2 mt-2">
                <label class="text-xs font-semibold text-gray-600 flex-shrink-0">최대 점수:</label>
                <input type="number" class="criterion-max-score w-24 px-3 py-1 border border-gray-200 rounded text-sm" placeholder="4" min="1" max="100" value="4" required>
                <span class="text-xs text-gray-500">점</span>
              </div>
            `;
            container.appendChild(div);
          }

          function removeCriterion(id) {
            document.getElementById(`criterion-${id}`).remove();
          }

          // Reference materials management
          function updateReferenceCount() {
            const count = document.querySelectorAll('#assignmentReferenceMaterials .reference-item').length;
            document.getElementById('referenceCount').textContent = `${count} / 11`;
            const addBtn = document.getElementById('addReferenceBtn');
            if (count >= 11) {
              addBtn.disabled = true;
              addBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
              addBtn.disabled = false;
              addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
          }

          function addReferenceMaterial() {
            const container = document.getElementById('assignmentReferenceMaterials');
            const count = container.querySelectorAll('.reference-item').length;
            if (count >= 11) return;

            const div = document.createElement('div');
            div.className = 'reference-item';
            div.innerHTML = `
              <div class="flex gap-2 mb-2">
                <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)"></textarea>
                <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="flex gap-3 items-center">
                <button type="button" onclick="handleReferenceImageUpload(this)" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs">
                  <i class="fas fa-image mr-1"></i>이미지 업로드
                </button>
                <label class="flex items-center gap-1 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                  <input type="checkbox" class="skip-ocr-checkbox w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked>
                  <span>OCR 건너뛰고 이미지 그대로 삽입</span>
                </label>
                <span class="text-xs text-gray-500 self-center upload-status"></span>
              </div>
            `;
            container.appendChild(div);
            updateReferenceCount();
          }

          function removeReferenceMaterial(btn) {
            const container = document.getElementById('assignmentReferenceMaterials');
            if (container.querySelectorAll('.reference-item').length <= 1) {
              alert('최소 1개의 참고 자료 슬롯은 유지해야 합니다.');
              return;
            }
            btn.closest('.reference-item').remove();
            updateReferenceCount();
          }

          // Handle reference image upload
          async function handleReferenceImageUpload(btn) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
              const file = e.target.files[0];
              if (!file) return;

              // Find elements using closest reference-item
              const referenceItem = btn.closest('.reference-item');
              const statusSpan = referenceItem.querySelector('.upload-status');
              const textarea = referenceItem.querySelector('.reference-input');
              const skipOcrCheckbox = referenceItem.querySelector('.skip-ocr-checkbox');
              const skipOcr = skipOcrCheckbox ? skipOcrCheckbox.checked : false;
              
              console.log('=== Image Upload Debug ===');
              console.log('Reference item found:', !!referenceItem);
              console.log('Status span found:', !!statusSpan);
              console.log('Textarea found:', !!textarea);
              console.log('skipOcrCheckbox element:', skipOcrCheckbox);
              console.log('skipOcrCheckbox found:', !!skipOcrCheckbox);
              console.log('skipOcr value:', skipOcr);
              console.log('========================');
              
              if (!statusSpan || !textarea) {
                console.error('Required elements not found!');
                alert('요소를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
                return;
              }
              
              statusSpan.textContent = '업로드 중...';
              btn.disabled = true;

              try {
                const formData = new FormData();
                formData.append('file', file);
                // Add flag based on user's checkbox selection
                formData.append('skip_ocr', skipOcr ? 'true' : 'false');
                
                console.log('FormData skip_ocr:', formData.get('skip_ocr'));

                const response = await axios.post('/api/upload/image', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' }
                });

                // Helper function: append content to textarea without overwriting
                const appendToTextarea = (newContent) => {
                  const currentText = textarea.value.trim();
                  if (currentText) {
                    // Fix: Use actual newline character '\n' instead of escaped '\\n'
                    textarea.value = currentText + '\n\n' + newContent;
                  } else {
                    textarea.value = newContent;
                  }
                };

                // Sanitize filename for markdown (remove brackets that could break syntax)
                const safeFileName = file.name.replace(/[\[\]]/g, '');

                // Helper function to add image preview
                const addImagePreview = (imageUrl) => {
                  const previewContainer = referenceItem.querySelector('.image-preview-container');
                  if (previewContainer) {
                    // Show the preview container
                    previewContainer.style.display = 'flex';
                    
                    // Create image preview element
                    const previewWrapper = document.createElement('div');
                    previewWrapper.className = 'relative group';
                    previewWrapper.innerHTML = `
                      <img src="${imageUrl}" alt="업로드된 이미지" 
                           class="h-24 w-auto object-contain border border-gray-300 rounded cursor-pointer hover:border-blue-500 transition"
                           onclick="window.open('${imageUrl}', '_blank')">
                      <button type="button" 
                              class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition -mt-2 -mr-2"
                              onclick="this.parentElement.remove(); if(document.querySelectorAll('.image-preview-container > div').length === 0) { document.querySelector('.image-preview-container').style.display = 'none'; }">
                        <i class="fas fa-times text-xs"></i>
                      </button>
                    `;
                    previewContainer.appendChild(previewWrapper);
                  }
                };

                // If skip_ocr is checked and image URL is available, insert as Markdown
                if (skipOcr && response.data.image_url) {
                  const imageMarkdown = '![이미지](' + response.data.image_url + ')';
                  appendToTextarea(imageMarkdown);
                  
                  // Add image preview
                  addImagePreview(response.data.image_url);
                  
                  statusSpan.textContent = '✓ 이미지 삽입 완료';
                  statusSpan.className = 'text-xs text-green-600 self-center upload-status';
                } else if (response.data.extracted_text && response.data.extracted_text.trim()) {
                  // Fix: Check if extracted_text is not empty, and append instead of overwrite
                  appendToTextarea(response.data.extracted_text);
                  statusSpan.textContent = '✓ 텍스트 추출 완료';
                  statusSpan.className = 'text-xs text-green-600 self-center upload-status';
                } else if (response.data.image_url) {
                  // Fallback: insert image if OCR failed but we have URL
                  const imageMarkdown = '![이미지](' + response.data.image_url + ')';
                  appendToTextarea(imageMarkdown);
                  
                  // Add image preview
                  addImagePreview(response.data.image_url);
                  
                  statusSpan.textContent = '✓ 이미지 삽입 완료 (OCR 실패)';
                  statusSpan.className = 'text-xs text-green-600 self-center upload-status';
                } else {
                  statusSpan.textContent = '✓ 업로드 완료';
                  statusSpan.className = 'text-xs text-green-600 self-center upload-status';
                }
              } catch (error) {
                console.error('Image upload error:', error);
                statusSpan.textContent = '✗ 업로드 실패';
                statusSpan.className = 'text-xs text-red-600 self-center upload-status';
                alert('이미지 업로드에 실패했습니다: ' + (error.response?.data?.error || error.message));
              } finally {
                btn.disabled = false;
              }
            };
            input.click();
          }

          // Handle create assignment
          async function handleCreateAssignment(event) {
            event.preventDefault();

            const title = document.getElementById('assignmentTitle').value;
            const description = document.getElementById('assignmentDescription').value;
            const grade_level = document.getElementById('assignmentGradeLevel').value;
            const subject = document.getElementById('assignmentSubject').value;
            const due_date = document.getElementById('assignmentDueDate').value;

            // Collect prompts from reference materials
            const promptInputs = document.querySelectorAll('#assignmentReferenceMaterials .reference-input');
            const prompts = Array.from(promptInputs)
              .map(input => input.value.trim())
              .filter(text => text.length > 0);

            // Check which rubric type is selected
            const isCustomRubric = !document.getElementById('assignmentCustomRubricContainer').classList.contains('hidden');
            
            let rubric_criteria = [];
            
            if (isCustomRubric) {
              // Custom rubric
              const criteriaElements = document.querySelectorAll('#rubricCriteriaList > div');
              if (criteriaElements.length === 0) {
                alert('최소 1개의 평가 기준을 추가해주세요.');
                return;
              }
              rubric_criteria = Array.from(criteriaElements).map((el, idx) => {
                const maxScoreInput = el.querySelector('.criterion-max-score');
                const maxScore = maxScoreInput ? parseInt(maxScoreInput.value) || 4 : 4;
                return {
                  name: el.querySelector('.criterion-name').value,
                  description: el.querySelector('.criterion-description').value,
                  order: idx + 1,
                  max_score: maxScore
                };
              });
            } else {
              // Platform rubric
              const platformRubricType = document.getElementById('selectedPlatformRubric').value;
              if (!platformRubricType) {
                alert('플랫폼 루브릭을 선택해주세요.');
                return;
              }
              rubric_criteria = getPlatformRubricCriteria(platformRubricType);
            }

            try {
              await axios.post('/api/assignments', {
                title,
                description,
                grade_level,
                subject: subject || null,
                due_date: due_date || null,
                rubric_criteria,
                prompts
              });

              alert('과제가 생성되었습니다!');
              closeCreateAssignmentModal();
              loadAssignments();
            } catch (error) {
              console.error('Error creating assignment:', error);
              alert('과제 생성에 실패했습니다.');
            }
          }

          // Delete assignment
          async function deleteAssignment(assignmentId) {
            if (!confirm('정말 이 과제를 삭제하시겠습니까?')) return;

            try {
              await axios.delete(`/api/assignment/${assignmentId}`);
              alert('과제가 삭제되었습니다.');
              loadAssignments();
            } catch (error) {
              console.error('Error deleting assignment:', error);
              alert('삭제에 실패했습니다.');
            }
          }

          // Show/hide submission form
          function showAddSubmissionForm() {
            document.getElementById('addSubmissionForm').classList.remove('hidden');
          }

          function hideAddSubmissionForm() {
            document.getElementById('addSubmissionForm').classList.add('hidden');
            // Reset form
            document.getElementById('studentName').value = '';
            document.getElementById('studentEssay').value = '';
            clearSubmissionFile();
            clearAllFiles();
            switchSubmissionInputType('text');
          }

          // Global variable for selected submission file
          let selectedSubmissionFile = null;

          // Switch between text and file input for submission
          function switchSubmissionInputType(type) {
            const textInputBtn = document.getElementById('submissionTextInputBtn');
            const fileInputBtn = document.getElementById('submissionFileInputBtn');
            const textInputContainer = document.getElementById('submissionTextInputContainer');
            const fileInputContainer = document.getElementById('submissionFileInputContainer');
            const essayTextarea = document.getElementById('studentEssay');
            const studentNameContainer = document.getElementById('studentNameContainer');
            const studentNameInput = document.getElementById('studentName');
            
            if (type === 'text') {
              textInputBtn.classList.add('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              fileInputBtn.classList.remove('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              textInputContainer.classList.remove('hidden');
              fileInputContainer.classList.add('hidden');
              essayTextarea.required = true;
              
              // Show student name field for text input
              if (studentNameContainer) studentNameContainer.classList.remove('hidden');
              if (studentNameInput) studentNameInput.setAttribute('required', 'required');
              
              // Clear multiple files if any
              clearAllFiles();
            } else {
              fileInputBtn.classList.add('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              textInputBtn.classList.remove('active', 'bg-navy-900', 'text-white', 'border-navy-900');
              fileInputContainer.classList.remove('hidden');
              textInputContainer.classList.add('hidden');
              essayTextarea.required = false;
              
              // Show student name field initially (will be hidden if multiple files selected)
              if (studentNameContainer) studentNameContainer.classList.remove('hidden');
              if (studentNameInput) studentNameInput.setAttribute('required', 'required');
            }
          }

          // Format file size for display
          function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
          }

          // Compress image to fit OCR size limit (under 900KB)
          async function compressImage(file, maxSizeKB = 900) {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  
                  // Calculate resize ratio to target ~800KB
                  const fileSizeKB = file.size / 1024;
                  if (fileSizeKB <= maxSizeKB) {
                    // File is already small enough
                    resolve(file);
                    return;
                  }
                  
                  // Reduce dimensions to reduce file size
                  const scaleFactor = Math.sqrt(maxSizeKB / fileSizeKB);
                  width = Math.floor(width * scaleFactor);
                  height = Math.floor(height * scaleFactor);
                  
                  canvas.width = width;
                  canvas.height = height;
                  
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, width, height);
                  
                  // Convert to blob with quality adjustment
                  canvas.toBlob(function(blob) {
                    if (blob) {
                      // Create a new File object with the compressed blob
                      const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                      });
                      resolve(compressedFile);
                    } else {
                      reject(new Error('Failed to compress image'));
                    }
                  }, 'image/jpeg', 0.85); // 85% quality
                };
                img.onerror = reject;
                img.src = e.target.result;
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }

          // Handle file selection in submission form
          // Store multiple selected files with student names
          let selectedSubmissionFiles = [];
          
          // Extract student name from filename
          function extractStudentNameFromFilename(filename) {
            // Remove extension
            const nameWithoutExt = filename.replace(/\.(pdf|jpg|jpeg|png|gif|bmp|webp)$/i, '');
            
            // Remove common suffixes like "_답안", "_논술", "_과제" etc.
            const cleaned = nameWithoutExt.replace(/[_\-\s]*(답안|논술|과제|제출|submission)$/i, '').trim();
            
            return cleaned || '학생';
          }
          
          async function handleSubmissionFileSelect(event) {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;
            
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'application/pdf'];
            selectedSubmissionFiles = [];
            
            // Validate and process each file
            for (const file of files) {
              // Validate file size (10MB)
              if (file.size > 10 * 1024 * 1024) {
                alert(`파일 "${file.name}"의 크기가 10MB를 초과합니다. 건너뜁니다.`);
                continue;
              }
              
              // Validate file type
              if (!validTypes.includes(file.type)) {
                alert(`파일 "${file.name}"은(는) 지원하지 않는 형식입니다. 건너뜁니다.`);
                continue;
              }
              
              // Compress image if it's too large for OCR
              let processedFile = file;
              if (file.type.startsWith('image/') && file.size > 900 * 1024) {
                try {
                  console.log(`Compressing ${file.name}: ${formatFileSize(file.size)}`);
                  processedFile = await compressImage(file);
                  console.log(`Compressed to: ${formatFileSize(processedFile.size)}`);
                } catch (error) {
                  console.error('Failed to compress image:', error);
                  // Continue with original file if compression fails
                }
              }
              
              // Extract student name from filename
              const studentName = extractStudentNameFromFilename(file.name);
              
              selectedSubmissionFiles.push({
                file: processedFile,
                originalName: file.name,
                studentName: studentName,
                size: processedFile.size,
                type: file.type
              });
            }
            
            // Show multiple files UI
            if (selectedSubmissionFiles.length > 0) {
              displayMultipleFiles();
              document.getElementById('multipleFilesContainer').classList.remove('hidden');
              document.getElementById('submissionFilePreview').classList.add('hidden');
              
              // Hide student name field for multiple files (names are in the file list)
              const studentNameContainer = document.getElementById('studentNameContainer');
              const studentNameInput = document.getElementById('studentName');
              if (studentNameContainer) studentNameContainer.classList.add('hidden');
              if (studentNameInput) studentNameInput.removeAttribute('required');
            } else {
              alert('선택한 파일 중 유효한 파일이 없습니다.');
              event.target.value = '';
            }
          }
          
          // Display multiple files list
          function displayMultipleFiles() {
            const filesList = document.getElementById('filesList');
            const fileCount = document.getElementById('fileCount');
            
            fileCount.textContent = selectedSubmissionFiles.length;
            filesList.innerHTML = '';
            
            selectedSubmissionFiles.forEach((fileInfo, index) => {
              const fileItem = document.createElement('div');
              fileItem.className = 'bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3';
              fileItem.innerHTML = `
                <div class="flex-shrink-0">
                  <i class="fas ${fileInfo.type === 'application/pdf' ? 'fa-file-pdf text-red-600' : 'fa-image text-blue-600'} text-2xl"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-medium text-gray-900 truncate">${fileInfo.originalName}</span>
                    <span class="text-xs text-gray-500">(${formatFileSize(fileInfo.size)})</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-600">학생 이름:</label>
                    <input 
                      type="text" 
                      value="${fileInfo.studentName}"
                      onchange="updateStudentName(${index}, this.value)"
                      class="text-sm px-2 py-1 border border-gray-300 rounded flex-1"
                      placeholder="학생 이름 입력"
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onclick="removeFile(${index})"
                  class="flex-shrink-0 text-red-600 hover:text-red-800 px-2"
                >
                  <i class="fas fa-times"></i>
                </button>
              `;
              filesList.appendChild(fileItem);
            });
          }
          
          // Update student name for a file
          function updateStudentName(index, newName) {
            if (selectedSubmissionFiles[index]) {
              selectedSubmissionFiles[index].studentName = newName.trim();
            }
          }
          
          // Remove a file from the list
          function removeFile(index) {
            selectedSubmissionFiles.splice(index, 1);
            if (selectedSubmissionFiles.length > 0) {
              displayMultipleFiles();
            } else {
              clearAllFiles();
            }
          }
          
          // Clear all selected files
          function clearAllFiles() {
            selectedSubmissionFiles = [];
            document.getElementById('submissionEssayFile').value = '';
            document.getElementById('multipleFilesContainer').classList.add('hidden');
            
            // Show student name field again
            const studentNameContainer = document.getElementById('studentNameContainer');
            const studentNameInput = document.getElementById('studentName');
            if (studentNameContainer) studentNameContainer.classList.remove('hidden');
            if (studentNameInput) studentNameInput.setAttribute('required', 'required');
          }

          // Clear selected file in submission form
          function clearSubmissionFile() {
            selectedSubmissionFile = null;
            const fileInput = document.getElementById('submissionEssayFile');
            if (fileInput) fileInput.value = '';
            const filePreview = document.getElementById('submissionFilePreview');
            if (filePreview) filePreview.classList.add('hidden');
            const imagePreview = document.getElementById('submissionImagePreview');
            if (imagePreview) imagePreview.classList.add('hidden');
          }

          // Upload submission file and extract text
          async function uploadSubmissionFileAndExtractText(file) {
            // Determine endpoint based on file type
            let endpoint = '/api/upload/image';
            if (file.type === 'application/pdf') {
              endpoint = '/api/upload/pdf';
            }
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
              // Show processing message
              const response = await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              
              if (response.data && response.data.extracted_text) {
                return response.data.extracted_text;
              } else {
                // Check if there's a specific error message from the server
                const errorMsg = response.data?.error || '텍스트 추출에 실패했습니다. 이미지가 명확한지, 텍스트가 포함되어 있는지 확인해주세요.';
                throw new Error(errorMsg);
              }
            } catch (error) {
              console.error('File upload error:', error);
              
              // Extract error message from various possible sources
              if (error.response && error.response.data && error.response.data.error) {
                throw new Error(error.response.data.error);
              } else if (error.message) {
                throw new Error(error.message);
              } else {
                throw new Error('파일 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
              }
            }
          }

          // Handle add submission
          async function handleAddSubmission(event) {
            event.preventDefault();

            const student_name = document.getElementById('studentName').value;
            const isFileInput = !document.getElementById('submissionFileInputContainer').classList.contains('hidden');
            
            try {
              if (isFileInput) {
                // Check if multiple files or single file mode
                if (selectedSubmissionFiles.length > 0) {
                  // Multiple files mode - batch upload
                  await handleBatchSubmissionUpload(event);
                } else if (selectedSubmissionFile) {
                  // Legacy single file mode (fallback)
                  await handleSingleSubmissionUpload(event, student_name);
                } else {
                  alert('파일을 선택해주세요.');
                  return;
                }
              } else {
                // Text input mode
                await handleSingleSubmissionUpload(event, student_name);
              }
            } catch (error) {
              console.error('Error adding submission:', error);
              alert('답안지 추가에 실패했습니다.');
            }
          }
          
          // Handle single submission upload (text or single file)
          async function handleSingleSubmissionUpload(event, student_name) {
            const isFileInput = !document.getElementById('submissionFileInputContainer').classList.contains('hidden');
            let essay_text = '';
            
            const submitButton = event.target.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            
            try {
              if (isFileInput && selectedSubmissionFile) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>파일 처리 중...';
                
                // Upload file and extract text
                essay_text = await uploadSubmissionFileAndExtractText(selectedSubmissionFile);
                
                if (!essay_text || essay_text.trim() === '') {
                  throw new Error('파일에서 텍스트를 추출할 수 없습니다.');
                }
              } else {
                // Text input mode
                essay_text = document.getElementById('studentEssay').value;
              }
              
              // Submit the essay
              await axios.post(`/api/assignment/${currentAssignmentId}/submission`, {
                student_name,
                essay_text
              });

              alert('답안지가 추가되었습니다!');
              hideAddSubmissionForm();
              viewAssignment(currentAssignmentId);
            } catch (uploadError) {
              throw uploadError;
            } finally {
              if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
              }
            }
          }
          
          // Handle batch submission upload (multiple files)
          async function handleBatchSubmissionUpload(event) {
            // Validate that all files have student names
            const filesWithoutNames = selectedSubmissionFiles.filter(f => !f.studentName || f.studentName.trim() === '');
            if (filesWithoutNames.length > 0) {
              alert('모든 파일에 학생 이름을 입력해주세요.');
              return;
            }
            
            const submitButton = event.target.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            
            const totalFiles = selectedSubmissionFiles.length;
            let successCount = 0;
            let failCount = 0;
            const errors = [];
            
            // Create progress modal
            showBatchUploadProgress(totalFiles);
            
            try {
              for (let i = 0; i < selectedSubmissionFiles.length; i++) {
                const fileInfo = selectedSubmissionFiles[i];
                
                // Update progress
                updateBatchUploadProgress(i + 1, totalFiles, fileInfo.studentName, fileInfo.originalName);
                
                try {
                  // Upload file and extract text
                  const essay_text = await uploadSubmissionFileAndExtractText(fileInfo.file);
                  
                  if (!essay_text || essay_text.trim() === '') {
                    throw new Error('텍스트 추출 실패');
                  }
                  
                  // Submit the essay
                  await axios.post(`/api/assignment/${currentAssignmentId}/submission`, {
                    student_name: fileInfo.studentName,
                    essay_text
                  });
                  
                  successCount++;
                } catch (fileError) {
                  console.error(`Error processing ${fileInfo.originalName}:`, fileError);
                  failCount++;
                  errors.push({
                    fileName: fileInfo.originalName,
                    studentName: fileInfo.studentName,
                    error: fileError.message
                  });
                }
              }
              
              // Show results
              showBatchUploadResults(successCount, failCount, errors);
              
              // Clean up and reload
              hideAddSubmissionForm();
              clearAllFiles();
              viewAssignment(currentAssignmentId);
              
            } catch (error) {
              console.error('Batch upload error:', error);
              alert('일괄 업로드 중 오류가 발생했습니다.');
            } finally {
              submitButton.disabled = false;
              submitButton.innerHTML = originalButtonText;
              closeBatchUploadProgress();
            }
          }
          
          // Show batch upload progress modal
          function showBatchUploadProgress(totalFiles) {
            const modal = document.createElement('div');
            modal.id = 'batchUploadProgressModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
              <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                  <i class="fas fa-upload mr-2 text-navy-700"></i>답안지 일괄 업로드 중
                </h3>
                <div class="mb-4">
                  <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <span>진행률</span>
                    <span id="batchProgress">0 / ${totalFiles}</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-3">
                    <div id="batchProgressBar" class="bg-navy-700 h-3 rounded-full transition-all" style="width: 0%"></div>
                  </div>
                </div>
                <div class="text-sm text-gray-700">
                  <p><strong>현재 처리 중:</strong></p>
                  <p id="currentStudent" class="text-navy-700 font-medium">-</p>
                  <p id="currentFile" class="text-gray-500 text-xs truncate mt-1">-</p>
                </div>
              </div>
            `;
            document.body.appendChild(modal);
          }
          
          // Update batch upload progress
          function updateBatchUploadProgress(current, total, studentName, fileName) {
            const progressText = document.getElementById('batchProgress');
            const progressBar = document.getElementById('batchProgressBar');
            const currentStudent = document.getElementById('currentStudent');
            const currentFile = document.getElementById('currentFile');
            
            if (progressText) progressText.textContent = `${current} / ${total}`;
            if (progressBar) progressBar.style.width = `${(current / total) * 100}%`;
            if (currentStudent) currentStudent.textContent = studentName;
            if (currentFile) currentFile.textContent = fileName;
          }
          
          // Close batch upload progress modal
          function closeBatchUploadProgress() {
            const modal = document.getElementById('batchUploadProgressModal');
            if (modal) modal.remove();
          }
          
          // Show batch upload results
          function showBatchUploadResults(successCount, failCount, errors) {
            let message = `업로드 완료!\n\n성공: ${successCount}개`;
            
            if (failCount > 0) {
              message += `\n실패: ${failCount}개\n\n실패한 파일:\n`;
              errors.forEach(err => {
                message += `- ${err.studentName} (${err.fileName}): ${err.error}\n`;
              });
            }
            
            alert(message);
          }

          // Grade submission
          // Global variable to store current grading data
          let currentGradingData = null;

          async function gradeSubmission(submissionId) {
            console.log('gradeSubmission called with submissionId:', submissionId, 'Type:', typeof submissionId);
            // Show grading settings modal
            showGradingSettingsModal(submissionId);
          }
          
          async function executeGrading(submissionId, feedbackLevel, strictness) {
            console.log('Execute Grading called with:', {
              submissionId,
              feedbackLevel,
              strictness,
              submissionIdType: typeof submissionId
            });
            
            // Validate submission ID
            if (!submissionId || isNaN(submissionId)) {
              alert('유효하지 않은 답안지 ID입니다: ' + submissionId);
              return;
            }
            
            // Find the button in the submissions list
            const buttons = document.querySelectorAll('button[onclick*="gradeSubmission(' + submissionId + '"]');
            const button = buttons.length > 0 ? buttons[0] : null;
            let originalText = '';
            
            if (button) {
              originalText = button.innerHTML;
              button.disabled = true;
              button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>채점 중...';
            }

            try {
              // Get submission details
              console.log('Fetching submission:', submissionId);
              const submissionResponse = await axios.get(`/api/submission/${submissionId}`);
              const submissionData = submissionResponse.data;
              console.log('Submission data received:', submissionData);
              
              // Grade submission with settings
              const response = await axios.post(`/api/submission/${submissionId}/grade`, {
                feedback_level: feedbackLevel,
                grading_strictness: strictness
              });
              
              if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
              }
              
              if (response.data.success) {
                // Store grading data for review
                currentGradingData = {
                  submissionId: submissionId,
                  submission: submissionData,
                  result: response.data.grading_result,
                  detailedFeedback: response.data.detailed_feedback,
                  fromHistory: false  // Mark that this was opened from assignment view
                };
                
                // Show review modal
                showGradingReviewModal();
              } else {
                throw new Error(response.data.error || '채점 실패');
              }
            } catch (error) {
              console.error('Error grading submission:', error);
              alert('채점에 실패했습니다: ' + (error.response?.data?.error || error.message));
              
              if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
              }
            }
          }

          function showGradingLoadingModal() {
            // Create loading modal
            const loadingModalHTML = '<div id="gradingLoadingModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">' +
              '<div class="bg-white rounded-xl shadow-2xl p-8 max-w-md">' +
                '<div class="text-center">' +
                  '<div class="mb-4">' +
                    '<i class="fas fa-spinner fa-spin text-6xl text-navy-700"></i>' +
                  '</div>' +
                  '<h3 class="text-2xl font-bold text-gray-900 mb-2">채점 중</h3>' +
                  '<p class="text-gray-600">AI가 답안을 분석하고 있습니다...</p>' +
                  '<p class="text-sm text-gray-500 mt-4">잠시만 기다려 주세요 (약 10-30초 소요)</p>' +
                '</div>' +
              '</div>' +
            '</div>';
            
            document.body.insertAdjacentHTML('beforeend', loadingModalHTML);
          }

          function closeGradingLoadingModal() {
            const modal = document.getElementById('gradingLoadingModal');
            if (modal) {
              modal.remove();
            }
          }

          async function executeGradingWithLoading(submissionId, feedbackLevel, strictness) {
            console.log('Execute Grading With Loading called with:', {
              submissionId,
              feedbackLevel,
              strictness,
              submissionIdType: typeof submissionId
            });
            
            // Validate submission ID
            if (!submissionId || isNaN(submissionId)) {
              alert('유효하지 않은 답안지 ID입니다: ' + submissionId);
              closeGradingLoadingModal();
              return;
            }

            try {
              // Get submission details
              console.log('Fetching submission:', submissionId);
              const submissionResponse = await axios.get('/api/submission/' + submissionId);
              const submissionData = submissionResponse.data;
              console.log('Submission data received:', submissionData);
              
              // Grade submission with settings
              const response = await axios.post('/api/submission/' + submissionId + '/grade', {
                feedback_level: feedbackLevel,
                grading_strictness: strictness
              });
              
              // Close loading modal
              closeGradingLoadingModal();
              
              if (response.data.success) {
                // Store grading data for review
                currentGradingData = {
                  submissionId: submissionId,
                  submission: submissionData,
                  result: response.data.grading_result,
                  detailedFeedback: response.data.detailed_feedback,
                  fromHistory: true  // Mark that this was a regrade from history
                };
                
                // Show review modal
                showGradingReviewModal();
                
                // Refresh grading history list if we're on that tab
                const historyTab = document.getElementById('historyTab');
                if (historyTab && historyTab.classList.contains('active')) {
                  loadHistory();
                }
              } else {
                throw new Error(response.data.error || '채점 실패');
              }
            } catch (error) {
              console.error('Error grading submission:', error);
              closeGradingLoadingModal();
              alert('채점에 실패했습니다: ' + (error.response?.data?.error || error.message));
            }
          }

          function showGradingReviewModal() {
            if (!currentGradingData) return;
            
            const result = currentGradingData.result;
            const feedback = currentGradingData.detailedFeedback;
            const submission = currentGradingData.submission;
            
            // Calculate max score by summing up each criterion's max_score
            const maxScore = result.criterion_scores 
              ? result.criterion_scores.reduce((sum, criterion) => sum + (criterion.max_score || 4), 0)
              : 4;
            
            // Create modal HTML with split-screen layout
            const modalHTML = `
              <div id="gradingReviewModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                  <!-- Header -->
                  <div class="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
                    <h2 class="text-2xl font-bold text-gray-900">
                      <i class="fas fa-clipboard-check text-navy-700 mr-2"></i>
                      채점 결과 검토
                    </h2>
                    <button onclick="closeGradingReviewModal()" class="text-gray-400 hover:text-gray-600">
                      <i class="fas fa-times text-2xl"></i>
                    </button>
                  </div>
                  
                  <!-- Split Screen Content -->
                  <div class="flex-1 overflow-hidden flex">
                    <!-- Left Panel: Student Essay -->
                    <div class="w-1/2 border-r border-gray-200 flex flex-col">
                      <div class="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 class="text-lg font-bold text-gray-900">
                          <i class="fas fa-file-alt text-blue-600 mr-2"></i>
                          학생 답안
                        </h3>
                        <p class="text-sm text-gray-600 mt-1">${submission.student_name} - ${submission.assignment_title}</p>
                      </div>
                      <div class="flex-1 overflow-y-auto p-6">
                        <div class="prose max-w-none">
                          <div class="whitespace-pre-wrap text-gray-800 leading-relaxed">${submission.essay_text}</div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Right Panel: Feedback -->
                    <div class="w-1/2 flex flex-col">
                      <div class="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 class="text-lg font-bold text-gray-900">
                          <i class="fas fa-comment-dots text-green-600 mr-2"></i>
                          피드백 및 평가
                        </h3>
                      </div>
                      <div class="flex-1 overflow-y-auto p-6 space-y-6">
                    <!-- Overall Score -->
                    <div class="bg-gradient-to-r from-navy-50 to-blue-50 rounded-lg p-6 border-l-4 border-navy-700">
                      <div class="flex items-center justify-between mb-3">
                        <h3 class="text-lg font-bold text-gray-900">전체 점수</h3>
                        <div class="text-3xl font-bold text-navy-700">
                          <input type="number" id="editTotalScore" value="${result.total_score}" min="0" max="${maxScore}" step="0.1"
                            class="w-24 text-center border-2 border-navy-300 rounded-lg px-2 py-1" />
                          <span class="text-2xl text-gray-600">/${maxScore}</span>
                        </div>
                      </div>
                      <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">종합 평가</label>
                        <textarea id="editSummaryEvaluation" rows="3" 
                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                        >${result.summary_evaluation}</textarea>
                      </div>
                    </div>

                    <!-- Criterion Scores -->
                    <div>
                      <h3 class="text-lg font-bold text-gray-900 mb-3">
                        <i class="fas fa-list-check text-navy-700 mr-2"></i>
                        평가 기준별 점수
                      </h3>
                      <div class="space-y-4" id="criterionScoresContainer">
                        ${result.criterion_scores.map((criterion, index) => {
                          // Handle both old format (criterion) and new format (criterion_name)
                          const criterionName = criterion.criterion_name || criterion.criterion || '(기준명 없음)';
                          const criterionScore = criterion.score || 0;
                          const criterionStrengths = criterion.strengths || '';
                          const criterionImprovements = criterion.areas_for_improvement || '';
                          const criterionMaxScore = criterion.max_score || 4;
                          
                          return `
                          <div class="border border-gray-200 rounded-lg p-4 bg-white">
                            <div class="flex justify-between items-start mb-3">
                              <h4 class="font-semibold text-gray-900">${criterionName}</h4>
                              <div class="flex items-center gap-2">
                                <input type="number" id="editScore_${index}" value="${criterionScore}" min="0" max="${criterionMaxScore}" step="0.1"
                                  class="w-20 text-center border border-gray-300 rounded px-2 py-1" />
                                <span class="text-gray-600">/${criterionMaxScore}</span>
                              </div>
                            </div>
                            <div class="space-y-3">
                              <div>
                                <label class="block text-sm font-semibold text-green-700 mb-1">
                                  <i class="fas fa-check-circle mr-1"></i>강점
                                </label>
                                <textarea id="editStrengths_${index}" rows="2" 
                                  class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                >${criterionStrengths}</textarea>
                              </div>
                              <div>
                                <label class="block text-sm font-semibold text-orange-700 mb-1">
                                  <i class="fas fa-exclamation-circle mr-1"></i>개선점
                                </label>
                                <textarea id="editImprovements_${index}" rows="2" 
                                  class="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                >${criterionImprovements}</textarea>
                              </div>
                            </div>
                          </div>
                        `;
                        }).join('')}
                      </div>
                    </div>

                    <!-- Overall Comment -->
                    <div>
                      <label class="block text-sm font-semibold text-gray-700 mb-2">
                        <i class="fas fa-comment text-navy-700 mr-1"></i>
                        종합 의견
                      </label>
                      <textarea id="editOverallComment" rows="3" 
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >${result.overall_comment}</textarea>
                    </div>

                    <!-- Revision Suggestions -->
                    <div>
                      <label class="block text-sm font-semibold text-gray-700 mb-2">
                        <i class="fas fa-lightbulb text-yellow-600 mr-1"></i>
                        수정 제안
                      </label>
                      <textarea id="editRevisionSuggestions" rows="5" 
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >${result.revision_suggestions || ''}</textarea>
                    </div>

                        <!-- Next Steps -->
                        <div>
                          <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-forward text-blue-600 mr-1"></i>
                            다음 단계 조언
                          </label>
                          <textarea id="editNextSteps" rows="4" 
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          >${result.next_steps_advice || ''}</textarea>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-xl">
                    <!-- Print Button with Dropdown -->
                    <div class="relative">
                      <div class="flex">
                        <button onclick="printFeedback()" 
                          class="px-6 py-3 bg-green-600 text-white rounded-l-lg font-semibold hover:bg-green-700 transition">
                          <i class="fas fa-print mr-2"></i>출력
                        </button>
                        <button onclick="togglePrintDropdown()" 
                          class="px-3 py-3 bg-green-600 text-white rounded-r-lg font-semibold hover:bg-green-700 transition border-l border-green-700">
                          <i class="fas fa-chevron-down"></i>
                        </button>
                      </div>
                      <!-- Dropdown Menu -->
                      <div id="printDropdownMenu" class="hidden absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] z-50">
                        <button onclick="printReport()" 
                          class="w-full text-left px-4 py-2 hover:bg-gray-100 transition">
                          <i class="fas fa-file-alt mr-2 text-blue-600"></i>보고서 인쇄
                        </button>
                        <button onclick="exportToPDF()" 
                          class="w-full text-left px-4 py-2 hover:bg-gray-100 transition">
                          <i class="fas fa-file-pdf mr-2 text-red-600"></i>PDF로 내보내기
                        </button>
                      </div>
                    </div>
                    
                    <!-- Regrade Button -->
                    <button onclick="regradeSubmission()" 
                      class="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition">
                      <i class="fas fa-redo mr-2"></i>재채점
                    </button>
                    
                    <button onclick="saveFeedback()" 
                      class="flex-1 px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition">
                      <i class="fas fa-save mr-2"></i>저장하고 완료
                    </button>
                    <button onclick="closeGradingReviewModal()" 
                      class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">
                      <i class="fas fa-times mr-2"></i>취소
                    </button>
                  </div>
                </div>
              </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Setup dropdown event listeners after modal is created
            setupPrintDropdownListeners();
          }

          function closeGradingReviewModal() {
            const modal = document.getElementById('gradingReviewModal');
            if (modal) {
              modal.remove();
            }
            currentGradingData = null;
          }
          
          // Setup print dropdown listeners
          function setupPrintDropdownListeners() {
            const dropdownToggle = document.querySelector('button[onclick="togglePrintDropdown()"]');
            const dropdown = document.getElementById('printDropdownMenu');
            const printReportBtn = document.querySelector('button[onclick="printReport()"]');
            const exportPdfBtn = document.querySelector('button[onclick="exportToPDF()"]');
            
            if (dropdownToggle && dropdown) {
              console.log('Setting up print dropdown listeners');
              
              // Remove onclick attribute and use addEventListener
              dropdownToggle.removeAttribute('onclick');
              dropdownToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('Dropdown toggle clicked');
                dropdown.classList.toggle('hidden');
              });
              
              // Setup print report button
              if (printReportBtn) {
                printReportBtn.removeAttribute('onclick');
                printReportBtn.addEventListener('click', function(e) {
                  e.stopPropagation();
                  console.log('Print Report clicked');
                  dropdown.classList.add('hidden');
                  printFeedback();
                });
              }
              
              // Setup export to PDF button
              if (exportPdfBtn) {
                exportPdfBtn.removeAttribute('onclick');
                exportPdfBtn.addEventListener('click', function(e) {
                  e.stopPropagation();
                  console.log('Export to PDF clicked');
                  dropdown.classList.add('hidden');
                  exportToPDF();
                });
              }
              
              // Close dropdown when clicking outside
              setTimeout(() => {
                document.addEventListener('click', function(event) {
                  const isClickInside = dropdown.contains(event.target) || dropdownToggle.contains(event.target);
                  if (!isClickInside && !dropdown.classList.contains('hidden')) {
                    console.log('Closing dropdown - outside click');
                    dropdown.classList.add('hidden');
                  }
                });
              }, 100);
            }
          }
          
          // Toggle print dropdown menu (kept for compatibility)
          function togglePrintDropdown() {
            const dropdown = document.getElementById('printDropdownMenu');
            if (dropdown) {
              console.log('togglePrintDropdown called');
              dropdown.classList.toggle('hidden');
            }
          }
          
          // Print report function
          function printReport() {
            console.log('Print Report clicked');
            togglePrintDropdown();
            printFeedback(); // Use existing print functionality
          }
          
          // Export to PDF function using jsPDF
          async function exportToPDF() {
            console.log('Export to PDF clicked');
            
            if (!currentGradingData) {
              alert('채점 데이터를 찾을 수 없습니다.');
              togglePrintDropdown();
              return;
            }
            
            // Close dropdown first
            togglePrintDropdown();
            
            try {
              // Show loading message
              const loadingMsg = document.createElement('div');
              loadingMsg.id = 'pdf-loading';
              loadingMsg.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
              loadingMsg.innerHTML = `
                <div class="bg-white rounded-lg p-8 text-center">
                  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mx-auto mb-4"></div>
                  <p class="text-lg font-semibold">PDF 생성 중...</p>
                  <p class="text-sm text-gray-600 mt-2">잠시만 기다려주세요</p>
                </div>
              `;
              document.body.appendChild(loadingMsg);
              
              const submission = currentGradingData.submission;
              const result = currentGradingData.result;
              
              // Calculate max score by summing up each criterion's max_score
              const maxScore = result.criterion_scores 
                ? result.criterion_scores.reduce((sum, criterion) => sum + (criterion.max_score || 4), 0)
                : 4;
              
              // Collect current edited values
              const totalScore = document.getElementById('editTotalScore').value;
              const summaryEvaluation = document.getElementById('editSummaryEvaluation').value;
              const overallComment = document.getElementById('editOverallComment').value;
              const revisionSuggestions = document.getElementById('editRevisionSuggestions').value;
              const nextSteps = document.getElementById('editNextSteps').value;
              
              // Initialize jsPDF with Korean font support
              const { jsPDF } = window.jspdf;
              const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
              });
              
              // Set up Korean font (using default unicode support)
              doc.setFont('helvetica');
              
              let yPos = 20;
              const margin = 20;
              const pageWidth = 210;
              const maxWidth = pageWidth - (margin * 2);
              
              // Title
              doc.setFontSize(24);
              doc.setTextColor(30, 58, 138); // Navy color
              doc.text('AI 논술 채점 결과', margin, yPos);
              yPos += 15;
              
              // Header info
              doc.setFontSize(11);
              doc.setTextColor(0, 0, 0);
              doc.text(`과제: ${submission.assignment_title}`, margin, yPos);
              yPos += 7;
              doc.text(`학생: ${submission.student_name}`, margin, yPos);
              yPos += 7;
              doc.text(`제출일: ${new Date(submission.submitted_at).toLocaleString('ko-KR')}`, margin, yPos);
              yPos += 12;
              
              // Score box
              doc.setFillColor(30, 58, 138);
              doc.roundedRect(margin, yPos, maxWidth, 25, 3, 3, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(16);
              doc.text('전체 점수', pageWidth / 2, yPos + 8, { align: 'center' });
              doc.setFontSize(28);
              doc.text(`${totalScore} / ${maxScore}`, pageWidth / 2, yPos + 20, { align: 'center' });
              yPos += 35;
              
              // Helper function to add section
              function addSection(title, content, icon = '') {
                if (yPos > 250) {
                  doc.addPage();
                  yPos = 20;
                }
                
                doc.setFillColor(249, 250, 251);
                doc.roundedRect(margin, yPos, maxWidth, 8, 2, 2, 'F');
                doc.setFontSize(13);
                doc.setTextColor(30, 58, 138);
                doc.text(`${icon} ${title}`, margin + 3, yPos + 6);
                yPos += 12;
                
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                const lines = doc.splitTextToSize(content, maxWidth);
                doc.text(lines, margin, yPos);
                yPos += (lines.length * 5) + 8;
              }
              
              // Student Essay
              addSection('학생 답안', submission.essay_text.substring(0, 500) + '...', '📄');
              
              // Summary Evaluation
              addSection('종합 평가', summaryEvaluation, '📊');
              
              // Criterion Scores
              if (yPos > 230) {
                doc.addPage();
                yPos = 20;
              }
              
              doc.setFillColor(249, 250, 251);
              doc.roundedRect(margin, yPos, maxWidth, 8, 2, 2, 'F');
              doc.setFontSize(13);
              doc.setTextColor(30, 58, 138);
              doc.text('📋 평가 기준별 점수', margin + 3, yPos + 6);
              yPos += 15;
              
              result.criterion_scores.forEach((criterion, index) => {
                if (yPos > 260) {
                  doc.addPage();
                  yPos = 20;
                }
                
                const score = document.getElementById(`editScore_${index}`).value;
                const strengths = document.getElementById(`editStrengths_${index}`).value;
                const improvements = document.getElementById(`editImprovements_${index}`).value;
                
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                const maxScore = criterion.max_score || 4;
                doc.text(`${criterion.criterion_name}: ${score}/${maxScore}`, margin, yPos);
                yPos += 6;
                
                doc.setFontSize(9);
                doc.setTextColor(5, 150, 105);
                doc.text('강점:', margin + 3, yPos);
                yPos += 5;
                doc.setTextColor(0, 0, 0);
                const strengthLines = doc.splitTextToSize(strengths, maxWidth - 6);
                doc.text(strengthLines, margin + 3, yPos);
                yPos += (strengthLines.length * 4) + 3;
                
                doc.setTextColor(234, 88, 12);
                doc.text('개선점:', margin + 3, yPos);
                yPos += 5;
                doc.setTextColor(0, 0, 0);
                const improvementLines = doc.splitTextToSize(improvements, maxWidth - 6);
                doc.text(improvementLines, margin + 3, yPos);
                yPos += (improvementLines.length * 4) + 8;
              });
              
              // Other sections
              addSection('종합 의견', overallComment, '💬');
              addSection('수정 제안', revisionSuggestions, '💡');
              addSection('다음 단계 조언', nextSteps, '🎯');
              
              // Remove loading message
              document.getElementById('pdf-loading').remove();
              
              // Save PDF
              const filename = `채점결과_${submission.student_name}_${new Date().toISOString().split('T')[0]}.pdf`;
              doc.save(filename);
              
              alert('PDF 파일이 다운로드되었습니다!');
              
            } catch (error) {
              console.error('PDF 생성 오류:', error);
              document.getElementById('pdf-loading')?.remove();
              alert('PDF 생성 중 오류가 발생했습니다. 브라우저 인쇄 기능을 사용해주세요.');
              printFeedback();
            }
          }
          
          // Regrade submission function
          function regradeSubmission() {
            if (!currentGradingData) {
              alert('채점 데이터를 찾을 수 없습니다.');
              return;
            }
            
            // CRITICAL: Store submission ID BEFORE closing modal
            // because closeGradingReviewModal sets currentGradingData to null
            const submissionId = currentGradingData.submissionId;
            console.log('Regrade submission:', submissionId, 'Type:', typeof submissionId);
            
            if (!submissionId || isNaN(submissionId)) {
              alert('유효하지 않은 답안지 ID입니다: ' + submissionId);
              return;
            }
            
            // Close review modal
            closeGradingReviewModal();
            
            // Show grading settings modal for regrade with the stored ID
            showGradingSettingsModal(submissionId);
          }

          function printFeedback() {
            if (!currentGradingData) return;
            
            const submission = currentGradingData.submission;
            const result = currentGradingData.result;
            
            // Calculate max score by summing up each criterion's max_score
            const maxScore = result.criterion_scores 
              ? result.criterion_scores.reduce((sum, criterion) => sum + (criterion.max_score || 4), 0)
              : 4;
            
            // Collect current edited values
            const totalScore = document.getElementById('editTotalScore')?.value || '0';
            const summaryEvaluation = document.getElementById('editSummaryEvaluation')?.value || '';
            const overallComment = document.getElementById('editOverallComment')?.value || '';
            const revisionSuggestions = document.getElementById('editRevisionSuggestions')?.value || '';
            const nextSteps = document.getElementById('editNextSteps')?.value || '';
            
            // Build criterion scores HTML
            let criterionHTML = '';
            result.criterion_scores.forEach((criterion, index) => {
              const scoreEl = document.getElementById(`editScore_${index}`);
              const strengthsEl = document.getElementById(`editStrengths_${index}`);
              const improvementsEl = document.getElementById(`editImprovements_${index}`);
              
              const score = scoreEl?.value || '0';
              const strengths = strengthsEl?.value || '';
              const improvements = improvementsEl?.value || '';
              const maxScore = criterion.max_score || 4;
              
              criterionHTML += `
                <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>${criterion.criterion_name}</strong>
                    <span style="font-size: 18px; font-weight: bold; color: #1e3a8a;">${score}/${maxScore}</span>
                  </div>
                  <div style="margin-bottom: 8px;">
                    <strong style="color: #059669;">강점:</strong>
                    <p style="margin: 5px 0; white-space: pre-wrap;">${strengths}</p>
                  </div>
                  <div>
                    <strong style="color: #ea580c;">개선점:</strong>
                    <p style="margin: 5px 0; white-space: pre-wrap;">${improvements}</p>
                  </div>
                </div>
              `;
            });
            
            // Create print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <title>채점 결과 - ${submission.student_name}</title>
                <style>
                  body {
                    font-family: 'Noto Sans KR', Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  h1, h2, h3 { color: #1e3a8a; }
                  .header {
                    border-bottom: 3px solid #1e3a8a;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                  }
                  .section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background: #f9fafb;
                    border-radius: 8px;
                  }
                  .score-box {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    margin-bottom: 20px;
                  }
                  .score-box h2 {
                    color: white;
                    margin: 0 0 10px 0;
                  }
                  .score {
                    font-size: 48px;
                    font-weight: bold;
                  }
                  .essay-content {
                    background: white;
                    padding: 15px;
                    border-left: 4px solid #3b82f6;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                  }
                  @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>📝 AI 논술 채점 결과</h1>
                  <p><strong>과제:</strong> ${submission.assignment_title}</p>
                  <p><strong>학생:</strong> ${submission.student_name}</p>
                  <p><strong>제출일:</strong> ${new Date(submission.submitted_at).toLocaleString('ko-KR')}</p>
                </div>
                
                <div class="score-box">
                  <h2>전체 점수</h2>
                  <div class="score">${totalScore} / ${maxScore}</div>
                </div>
                
                <div class="section">
                  <h2>📄 학생 답안</h2>
                  <div class="essay-content">${submission.essay_text}</div>
                </div>
                
                <div class="section">
                  <h2>📊 종합 평가</h2>
                  <p style="white-space: pre-wrap;">${summaryEvaluation}</p>
                </div>
                
                <div class="section">
                  <h2>📋 평가 기준별 점수</h2>
                  ${criterionHTML}
                </div>
                
                <div class="section">
                  <h2>💬 종합 의견</h2>
                  <p style="white-space: pre-wrap;">${overallComment}</p>
                </div>
                
                <div class="section">
                  <h2>💡 수정 제안</h2>
                  <p style="white-space: pre-wrap;">${revisionSuggestions}</p>
                </div>
                
                <div class="section">
                  <h2>🎯 다음 단계 조언</h2>
                  <p style="white-space: pre-wrap;">${nextSteps}</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 30px;">
                  <button onclick="window.print()" style="padding: 10px 30px; background: #1e3a8a; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    🖨️ 인쇄하기
                  </button>
                  <button onclick="window.close()" style="padding: 10px 30px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-left: 10px;">
                    닫기
                  </button>
                </div>
              </body>
              </html>
            `);
            printWindow.document.close();
          }

          async function saveFeedback() {
            if (!currentGradingData) return;
            
            try {
              // Collect edited data with null checks
              const totalScoreEl = document.getElementById('editTotalScore');
              const summaryEvalEl = document.getElementById('editSummaryEvaluation');
              const overallCommentEl = document.getElementById('editOverallComment');
              const revisionSuggestionsEl = document.getElementById('editRevisionSuggestions');
              const nextStepsEl = document.getElementById('editNextSteps');
              
              if (!totalScoreEl || !summaryEvalEl || !overallCommentEl) {
                throw new Error('필수 입력 요소를 찾을 수 없습니다.');
              }
              
              const editedResult = {
                total_score: parseFloat(totalScoreEl.value) || 0,
                summary_evaluation: summaryEvalEl.value || '',
                overall_comment: overallCommentEl.value || '',
                revision_suggestions: revisionSuggestionsEl?.value || '',
                next_steps_advice: nextStepsEl?.value || '',
                criterion_scores: currentGradingData.result.criterion_scores.map((criterion, index) => {
                  const scoreEl = document.getElementById(`editScore_${index}`);
                  const strengthsEl = document.getElementById(`editStrengths_${index}`);
                  const improvementsEl = document.getElementById(`editImprovements_${index}`);
                  
                  return {
                    criterion_name: criterion.criterion_name,
                    score: parseInt(scoreEl?.value || '0'),
                    max_score: criterion.max_score || 4,
                    strengths: strengthsEl?.value || '',
                    areas_for_improvement: improvementsEl?.value || ''
                  };
                })
              };
              
              // Update feedback on server
              const response = await axios.put(`/api/submission/${currentGradingData.submissionId}/feedback`, {
                grading_result: editedResult
              });
              
              if (response.data.success) {
                alert('피드백이 저장되었습니다!');
                
                // CRITICAL: Save fromHistory flag BEFORE closing modal
                // closeGradingReviewModal() sets currentGradingData to null
                const isFromHistory = currentGradingData.fromHistory;
                
                closeGradingReviewModal();
                
                // If opened from grading history, reload history instead of viewAssignment
                if (isFromHistory) {
                  loadHistory();
                } else if (currentAssignmentId) {
                  viewAssignment(currentAssignmentId);
                }
              } else {
                throw new Error('피드백 저장 실패');
              }
            } catch (error) {
              console.error('Error saving feedback:', error);
              alert('피드백 저장에 실패했습니다: ' + (error.response?.data?.error || error.message));
            }
          }

          // Track selected submissions for export
          let selectedSubmissions = new Set();

          // Load history
          // Helper function to parse date strings as UTC and display in local timezone
          function toKST(dateString) {
            if (!dateString) return new Date();
            
            // Parse the date string as UTC
            // SQLite DATETIME format: "YYYY-MM-DD HH:MM:SS"
            // If it doesn't have timezone info, treat as UTC
            let date;
            if (dateString.endsWith('Z')) {
              // Already has UTC indicator
              date = new Date(dateString);
            } else if (dateString.includes('T')) {
              // ISO format without Z, treat as UTC
              date = new Date(dateString + 'Z');
            } else {
              // SQLite format: "2025-12-16 13:15:10"
              // Treat as UTC by appending Z
              date = new Date(dateString.replace(' ', 'T') + 'Z');
            }
            
            return date;
          }
          
          // State for sorting
          let sortField = 'submitted_at';
          let sortOrder = 'desc';
          
          async function loadHistory() {
            try {
              const response = await axios.get('/api/grading-history');
              let history = response.data;

              const container = document.getElementById('historyList');

              if (history.length === 0) {
                container.innerHTML = `
                  <div class="text-center py-12">
                    <i class="fas fa-history text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg">아직 채점 이력이 없습니다.</p>
                    <p class="text-gray-400 text-sm mt-2">학생 답안을 채점하면 여기에 기록이 남습니다.</p>
                  </div>
                `;
                return;
              }

              // Group submissions by assignment
              const groupedByAssignment = {};
              history.forEach(item => {
                const key = item.assignment_id || item.assignment_title;
                if (!groupedByAssignment[key]) {
                  groupedByAssignment[key] = {
                    title: item.assignment_title,
                    assignment_id: item.assignment_id,
                    submissions: [],
                    latest_submission_date: item.submitted_at // Track latest submission date for sorting
                  };
                }
                groupedByAssignment[key].submissions.push(item);
                // Update latest submission date if this submission is more recent
                if (new Date(item.submitted_at) > new Date(groupedByAssignment[key].latest_submission_date)) {
                  groupedByAssignment[key].latest_submission_date = item.submitted_at;
                }
              });

              // Sort assignments by latest submission date (most recent first)
              const sortedAssignments = Object.values(groupedByAssignment).sort((a, b) => {
                return new Date(b.latest_submission_date) - new Date(a.latest_submission_date);
              });

              // Create toolbar with action buttons
              const toolbar = `
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                  <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4">
                      <label class="flex items-center cursor-pointer">
                        <input type="checkbox" id="selectAll" onchange="toggleSelectAll()" class="w-4 h-4 text-navy-900 border-gray-300 rounded focus:ring-navy-500">
                        <span class="ml-2 text-sm font-medium text-gray-700">전체 선택</span>
                      </label>
                      <span class="text-sm text-gray-600">
                        <span id="selectedCount">0</span>개 선택됨
                      </span>
                      <button onclick="reviewSelected()" class="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        클릭하여 재검토 →
                      </button>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button onclick="deleteSelected()" id="deleteButton"
                        class="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled>
                        <i class="fas fa-trash mr-2"></i>제출물 삭제
                      </button>
                      <div class="relative">
                        <button id="exportButton" onclick="toggleExportMenu()" 
                          class="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled>
                          <i class="fas fa-print mr-2"></i>출력
                          <i class="fas fa-chevron-down ml-2 text-xs"></i>
                        </button>
                        <div id="exportMenu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                          <button onclick="exportMultipleToPDF()" class="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center border-b border-gray-100">
                            <i class="fas fa-file-pdf text-red-600 mr-3"></i>
                            <span class="font-medium">PDF (개별 출력)</span>
                          </button>
                          <button onclick="exportToSinglePDF()" class="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center">
                            <i class="fas fa-file-pdf text-blue-600 mr-3"></i>
                            <span class="font-medium">단일 PDF 파일로 내보내기</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `;

              // Render assignments with grouped submissions (sorted by latest submission date)
              const assignmentsHTML = sortedAssignments.map(assignment => {
                // Sort submissions based on current sort settings
                const sortedSubmissions = [...assignment.submissions].sort((a, b) => {
                  let comparison = 0;
                  switch(sortField) {
                    case 'student_name':
                      comparison = a.student_name.localeCompare(b.student_name, 'ko');
                      break;
                    case 'submitted_at':
                      comparison = new Date(a.submitted_at) - new Date(b.submitted_at);
                      break;
                    case 'graded_at':
                      comparison = new Date(a.graded_at) - new Date(b.graded_at);
                      break;
                    case 'overall_score':
                      comparison = a.overall_score - b.overall_score;
                      break;
                  }
                  return sortOrder === 'asc' ? comparison : -comparison;
                });

                return `
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <h3 class="text-lg font-bold text-gray-900">
                        <i class="fas fa-clipboard-list mr-2 text-navy-700"></i>
                        ${assignment.title}
                      </h3>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="w-full">
                        <thead class="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th class="px-6 py-3 text-left w-12">
                              <input type="checkbox" class="assignment-checkbox w-4 h-4 text-navy-900 border-gray-300 rounded" 
                                onchange="toggleAssignmentSelection(this)" data-assignment-id="${assignment.title}">
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onclick="sortSubmissions('student_name')">
                              성명
                              <i class="fas fa-sort${sortField === 'student_name' ? (sortOrder === 'asc' ? '-up' : '-down') : ''} ml-1 text-gray-400"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onclick="sortSubmissions('submitted_at')">
                              제출일
                              <i class="fas fa-sort${sortField === 'submitted_at' ? (sortOrder === 'asc' ? '-up' : '-down') : ''} ml-1 text-gray-400"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onclick="sortSubmissions('graded_at')">
                              채점일
                              <i class="fas fa-sort${sortField === 'graded_at' ? (sortOrder === 'asc' ? '-up' : '-down') : ''} ml-1 text-gray-400"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                              onclick="sortSubmissions('overall_score')">
                              평점
                              <i class="fas fa-sort${sortField === 'overall_score' ? (sortOrder === 'asc' ? '-up' : '-down') : ''} ml-1 text-gray-400"></i>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          ${sortedSubmissions.map(item => `
                            <tr class="hover:bg-gray-50 cursor-pointer" onclick="reviewSubmissionFromHistory(${item.submission_id})">
                              <td class="px-6 py-4" onclick="event.stopPropagation()">
                                <input type="checkbox" 
                                  class="submission-checkbox w-4 h-4 text-navy-900 border-gray-300 rounded focus:ring-navy-500" 
                                  data-submission-id="${item.submission_id}"
                                  data-assignment-id="${assignment.title}"
                                  onchange="updateSelection()">
                              </td>
                              <td class="px-6 py-4">
                                <div class="flex items-center">
                                  <div class="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center mr-3">
                                    <i class="fas fa-user text-navy-700 text-xs"></i>
                                  </div>
                                  <div>
                                    <div class="text-sm font-medium text-gray-900">${item.student_name}</div>
                                    <div class="text-xs text-gray-500">${item.grade_level}</div>
                                  </div>
                                </div>
                              </td>
                              <td class="px-6 py-4">
                                <div class="text-sm text-gray-900">
                                  ${toKST(item.submitted_at).toLocaleDateString('ko-KR')}
                                </div>
                                <div class="text-xs text-gray-500">
                                  ${toKST(item.submitted_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                                </div>
                              </td>
                              <td class="px-6 py-4">
                                <div class="text-sm text-gray-900">
                                  ${toKST(item.graded_at).toLocaleDateString('ko-KR')}
                                </div>
                                <div class="text-xs text-gray-500">
                                  ${toKST(item.graded_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}
                                </div>
                              </td>
                              <td class="px-6 py-4">
                                <div class="flex items-center">
                                  <span class="text-xl font-bold text-navy-900">${item.overall_score}</span>
                                  <span class="text-sm text-gray-500 ml-1">/${item.max_score || 4}</span>
                                </div>
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `;
              }).join('');

              container.innerHTML = toolbar + `<div class="space-y-6">${assignmentsHTML}</div>`;
                  `).join('')}
                </div>
              `;
            } catch (error) {
              console.error('Error loading history:', error);
              document.getElementById('historyList').innerHTML = `
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>채점 이력을 불러오는데 실패했습니다.</p>
                </div>
              `;
            }
          }

          async function reviewSubmissionFromHistory(submissionId) {
            try {
              // Check session before making requests
              const sessionId = getStorageItem('session_id');
              console.log('Review submission - Session ID:', sessionId);
              console.log('Review submission - Submission ID:', submissionId);
              
              if (!sessionId) {
                alert('로그인이 필요합니다.');
                window.location.href = '/login';
                return;
              }
              
              // Fetch submission details
              console.log('Fetching submission details...');
              const submissionResponse = await axios.get(`/api/submission/${submissionId}`);
              console.log('Submission response:', submissionResponse.status, submissionResponse.data);
              
              // Check if response indicates authentication error
              if (submissionResponse.status === 401) {
                alert('세션이 만료되었습니다. 다시 로그인해주세요.');
                removeStorageItem('session_id');
                window.location.href = '/login';
                return;
              }
              
              const submission = submissionResponse.data;
              
              // Fetch grading feedback (teacher API)
              console.log('Fetching feedback...');
              const feedbackResponse = await axios.get(`/api/submission/${submissionId}/feedback`);
              console.log('Feedback response:', feedbackResponse.status, feedbackResponse.data);
              const feedback = feedbackResponse.data;
              
              // Prepare grading data for modal
              // Extract grading_result from feedback response
              const gradingResult = feedback.grading_result || {};
              
              // Build criterion_scores array from grading_result
              const criterionScores = (gradingResult.criterion_scores || []).map(criterion => ({
                criterion_name: criterion.criterion_name || criterion.criterion || '평가 기준',
                score: criterion.score || 0,
                strengths: criterion.strengths || '강점 정보 없음',
                areas_for_improvement: criterion.areas_for_improvement || '개선점 정보 없음'
              }));
              
              currentGradingData = {
                submissionId: submissionId,
                submission: submission,
                result: {
                  total_score: gradingResult.total_score || feedback.overall_score || 0,
                  summary_evaluation: gradingResult.summary_evaluation || '종합 평가 정보가 저장되지 않았습니다.',
                  overall_comment: gradingResult.overall_comment || feedback.overall_feedback || '전체 피드백 정보가 저장되지 않았습니다.',
                  revision_suggestions: gradingResult.revision_suggestions || '수정 제안 정보가 저장되지 않았습니다.',
                  next_steps_advice: gradingResult.next_steps_advice || '다음 단계 조언 정보가 저장되지 않았습니다.',
                  criterion_scores: criterionScores
                },
                detailedFeedback: feedback,
                fromHistory: true  // Mark that this was opened from grading history
              };
              
              // Show the review modal
              showGradingReviewModal();
            } catch (error) {
              console.error('Error loading submission for review:', error);
              
              // Don't show another alert if it's a 401 error (interceptor already handled it)
              if (error.response?.status === 401) {
                return;
              }
              
              alert('답안 정보를 불러오는데 실패했습니다: ' + (error.response?.data?.error || error.message));
            }
          }

          function toggleSelectAll() {
            const selectAll = document.getElementById('selectAll');
            const checkboxes = document.querySelectorAll('.submission-checkbox');
            
            checkboxes.forEach(checkbox => {
              checkbox.checked = selectAll.checked;
            });
            
            updateSelection();
          }

          function updateSelection() {
            const checkboxes = document.querySelectorAll('.submission-checkbox:checked');
            selectedSubmissions = new Set(Array.from(checkboxes).map(cb => cb.dataset.submissionId));
            
            const count = selectedSubmissions.size;
            document.getElementById('selectedCount').textContent = count;
            
            const exportButton = document.getElementById('exportButton');
            const deleteButton = document.getElementById('deleteButton');
            
            if (exportButton) exportButton.disabled = count === 0;
            if (deleteButton) deleteButton.disabled = count === 0;
            
            // Update "select all" checkbox state
            const allCheckboxes = document.querySelectorAll('.submission-checkbox');
            const selectAllCheckbox = document.getElementById('selectAll');
            if (selectAllCheckbox) {
              selectAllCheckbox.checked = allCheckboxes.length > 0 && count === allCheckboxes.length;
              selectAllCheckbox.indeterminate = count > 0 && count < allCheckboxes.length;
            }
          }
          
          function toggleAssignmentSelection(checkbox) {
            const assignmentId = checkbox.dataset.assignmentId;
            const assignmentCheckboxes = document.querySelectorAll(`.submission-checkbox[data-assignment-id="${assignmentId}"]`);
            
            assignmentCheckboxes.forEach(cb => {
              cb.checked = checkbox.checked;
            });
            
            updateSelection();
          }
          
          function sortSubmissions(field) {
            if (sortField === field) {
              // Toggle sort order
              sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
              // New field, default to descending
              sortField = field;
              sortOrder = 'desc';
            }
            
            // Reload history with new sort
            loadHistory();
          }
          
          function reviewSelected() {
            if (selectedSubmissions.size === 0) {
              alert('선택된 제출물이 없습니다.');
              return;
            }
            
            // Open first selected submission for review
            const firstSubmissionId = Array.from(selectedSubmissions)[0];
            reviewSubmissionFromHistory(firstSubmissionId);
          }
          
          async function deleteSelected() {
            if (selectedSubmissions.size === 0) {
              alert('선택된 제출물이 없습니다.');
              return;
            }
            
            const count = selectedSubmissions.size;
            if (!confirm(`선택된 ${count}개의 제출물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
              return;
            }
            
            try {
              const deletePromises = Array.from(selectedSubmissions).map(submissionId =>
                axios.delete(`/api/submissions/${submissionId}`)
              );
              
              await Promise.all(deletePromises);
              
              alert(`${count}개의 제출물이 삭제되었습니다.`);
              
              // Clear selection and reload history
              selectedSubmissions.clear();
              loadHistory();
            } catch (error) {
              console.error('삭제 실패:', error);
              alert('제출물 삭제 중 오류가 발생했습니다.');
            }
          }

          function toggleExportMenu() {
            const menu = document.getElementById('exportMenu');
            menu.classList.toggle('hidden');
          }

          // Close export menu when clicking outside
          document.addEventListener('click', function(event) {
            const menu = document.getElementById('exportMenu');
            const button = document.getElementById('exportButton');
            if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
              menu.classList.add('hidden');
            }
          });

          async function exportMultipleToPDF() {
            if (selectedSubmissions.size === 0) return;
            
            document.getElementById('exportMenu').classList.add('hidden');
            
            // Open each submission in a new window for printing
            for (const submissionId of selectedSubmissions) {
              await printSubmission(submissionId);
              // Add delay to prevent browser blocking multiple windows
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          async function exportToSinglePDF() {
            if (selectedSubmissions.size === 0) return;
            
            document.getElementById('exportMenu').classList.add('hidden');
            
            try {
              // Fetch all selected submission details
              const submissions = await Promise.all(
                Array.from(selectedSubmissions).map(id => 
                  axios.get(`/api/submission/${id}`).then(res => res.data)
                )
              );
              
              // Generate combined HTML for all submissions
              const combinedHTML = await generateCombinedPDF(submissions);
              
              // Open in new window
              const printWindow = window.open('', '_blank');
              
              // Check if popup was blocked
              if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.\n\n또는 브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여 팝업을 허용해주세요.');
                return;
              }
              
              printWindow.document.write(combinedHTML);
              printWindow.document.close();
            } catch (error) {
              console.error('Error generating combined PDF:', error);
              
              // Better error handling
              if (error.response?.status === 401 || error.response?.status === 403) {
                alert('인증 오류가 발생했습니다. 다시 로그인해주세요.');
                removeStorageItem('session_id');
                window.location.href = '/login';
              } else {
                alert('PDF 생성에 실패했습니다: ' + error.message);
              }
            }
          }

          async function printSubmission(submissionId) {
            try {
              const response = await axios.get(`/api/submission/${submissionId}`);
              const submission = response.data;
              
              // Get feedback details (use teacher API endpoint)
              const feedbackResponse = await axios.get(`/api/submission/${submissionId}/feedback`);
              const feedback = feedbackResponse.data;
              
              // Generate print HTML
              const printHTML = generatePrintHTML(submission, feedback);
              
              const printWindow = window.open('', '_blank');
              
              // Check if popup was blocked
              if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
                alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.\n\n또는 브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여 팝업을 허용해주세요.');
                return;
              }
              
              printWindow.document.write(printHTML);
              printWindow.document.close();
            } catch (error) {
              console.error('Error printing submission:', error);
              
              // Better error handling
              if (error.response?.status === 401 || error.response?.status === 403) {
                alert('인증 오류가 발생했습니다. 다시 로그인해주세요.');
                removeStorageItem('session_id');
                window.location.href = '/login';
              } else {
                alert(`답안지 ${submissionId} 출력에 실패했습니다: ${error.message}`);
              }
            }
          }

          function generatePrintHTML(submission, feedback) {
            // Handle API response structure
            const gradingResult = feedback.grading_result || {};
            const criterionScores = gradingResult.criterion_scores || [];
            
            // Calculate max score by summing up each criterion's max_score
            const maxScore = criterionScores.length > 0
              ? criterionScores.reduce((sum, criterion) => sum + (criterion.max_score || 4), 0)
              : 4;
            
            const totalScore = gradingResult.total_score || feedback.overall_score || 0;
            const summaryEvaluation = gradingResult.summary_evaluation || feedback.overall_feedback || '종합 평가 없음';
            const overallComment = gradingResult.overall_comment || '전체 의견 없음';
            const revisionSuggestions = gradingResult.revision_suggestions || '수정 제안 없음';
            const nextSteps = gradingResult.next_steps_advice || '다음 단계 조언 없음';
            
            let criterionHTML = '';
            criterionScores.forEach(criterion => {
              const maxScore = criterion.max_score || 4;
              criterionHTML += `
                <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>${criterion.criterion_name || '평가 기준'}</strong>
                    <span style="font-size: 18px; font-weight: bold; color: #1e3a8a;">${criterion.score || 0}/${maxScore}</span>
                  </div>
                  <div style="margin-bottom: 8px;">
                    <strong style="color: #059669;">강점:</strong>
                    <p style="margin: 5px 0; white-space: pre-wrap;">${criterion.strengths || '없음'}</p>
                  </div>
                  <div>
                    <strong style="color: #ea580c;">개선점:</strong>
                    <p style="margin: 5px 0; white-space: pre-wrap;">${criterion.areas_for_improvement || '없음'}</p>
                  </div>
                </div>
              `;
            });
            
            return `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <title>채점 결과 - ${submission.student_name}</title>
                <style>
                  body {
                    font-family: 'Noto Sans KR', Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  h1, h2, h3 { color: #1e3a8a; }
                  .header {
                    border-bottom: 3px solid #1e3a8a;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                  }
                  .section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background: #f9fafb;
                    border-radius: 8px;
                  }
                  .score-box {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    margin-bottom: 20px;
                  }
                  .score-box h2 {
                    color: white;
                    margin: 0 0 10px 0;
                  }
                  .score {
                    font-size: 48px;
                    font-weight: bold;
                  }
                  .essay-content {
                    background: white;
                    padding: 15px;
                    border-left: 4px solid #3b82f6;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                  }
                  @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>📝 AI 논술 채점 결과</h1>
                  <p><strong>과제:</strong> ${submission.assignment_title}</p>
                  <p><strong>학생:</strong> ${submission.student_name}</p>
                  <p><strong>제출일:</strong> ${new Date(submission.submitted_at).toLocaleString('ko-KR')}</p>
                </div>
                
                <div class="score-box">
                  <h2>전체 점수</h2>
                  <div class="score">${totalScore} / ${maxScore}</div>
                </div>
                
                <div class="section">
                  <h2>📄 학생 답안</h2>
                  <div class="essay-content">${submission.essay_text}</div>
                </div>
                
                <div class="section">
                  <h2>📋 평가 기준별 점수</h2>
                  ${criterionHTML}
                </div>
                
                <div class="section">
                  <h2>📊 종합 평가</h2>
                  <p style="white-space: pre-wrap;">${summaryEvaluation}</p>
                </div>
                
                <div class="section">
                  <h2>💬 전체 의견</h2>
                  <p style="white-space: pre-wrap;">${overallComment}</p>
                </div>
                
                <div class="section">
                  <h2>💡 수정 제안</h2>
                  <p style="white-space: pre-wrap;">${revisionSuggestions}</p>
                </div>
                
                <div class="section">
                  <h2>🎯 다음 단계 조언</h2>
                  <p style="white-space: pre-wrap;">${nextSteps}</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 30px;">
                  <button onclick="window.print()" style="padding: 10px 30px; background: #1e3a8a; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    🖨️ 인쇄하기
                  </button>
                  <button onclick="window.close()" style="padding: 10px 30px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-left: 10px;">
                    닫기
                  </button>
                </div>
              </body>
              </html>
            `;
          }

          async function generateCombinedPDF(submissions) {
            let combinedContent = '';
            
            for (let i = 0; i < submissions.length; i++) {
              const submission = submissions[i];
              
              try {
                const feedbackResponse = await axios.get(`/api/submission/${submission.id}/feedback`);
                const feedback = feedbackResponse.data;
                const gradingResult = feedback.grading_result || {};
                const criterionScores = gradingResult.criterion_scores || [];
                
                let criterionHTML = '';
                criterionScores.forEach(criterion => {
                  criterionHTML += `
                    <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>${criterion.criterion_name || '평가 기준'}</strong>
                        <span style="font-size: 18px; font-weight: bold; color: #1e3a8a;">${criterion.score || 0}/${criterion.max_score || 4}</span>
                      </div>
                      <div style="margin-bottom: 8px;">
                        <strong style="color: #059669;">강점:</strong>
                        <p style="margin: 5px 0; white-space: pre-wrap;">${criterion.strengths || '없음'}</p>
                      </div>
                      <div>
                        <strong style="color: #ea580c;">개선점:</strong>
                        <p style="margin: 5px 0; white-space: pre-wrap;">${criterion.areas_for_improvement || '없음'}</p>
                      </div>
                    </div>
                  `;
                });
                
                // 최대 점수 동적 계산
                const maxScore = criterionScores.length > 0
                  ? criterionScores.reduce((sum, criterion) => sum + (criterion.max_score || 4), 0)
                  : 4;
                
                combinedContent += `
                  <div class="submission-section" style="${i > 0 ? 'page-break-before: always;' : ''}">
                    <div class="header">
                      <h1>📝 AI 논술 채점 결과 (${i + 1}/${submissions.length})</h1>
                      <p><strong>과제:</strong> ${submission.assignment_title}</p>
                      <p><strong>학생:</strong> ${submission.student_name}</p>
                      <p><strong>제출일:</strong> ${new Date(submission.submitted_at).toLocaleString('ko-KR')}</p>
                    </div>
                    
                    <div class="score-box">
                      <h2>전체 점수</h2>
                      <div class="score">${gradingResult.total_score || 0} / ${maxScore}</div>
                    </div>
                    
                    <div class="section">
                      <h2>📄 학생 답안</h2>
                      <div class="essay-content">${submission.essay_text}</div>
                    </div>
                    
                    <div class="section">
                      <h2>📋 평가 기준별 점수</h2>
                      ${criterionHTML}
                    </div>
                    
                    <div class="section">
                      <h2>💬 종합 의견</h2>
                      <p style="white-space: pre-wrap;">${gradingResult.overall_comment || '없음'}</p>
                    </div>
                  </div>
                `;
              } catch (error) {
                console.error(`Error fetching feedback for submission ${submission.id}:`, error);
              }
            }
            
            return `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <title>채점 결과 통합 문서 - ${submissions.length}개 답안</title>
                <style>
                  body {
                    font-family: 'Noto Sans KR', Arial, sans-serif;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  h1, h2, h3 { color: #1e3a8a; }
                  .header {
                    border-bottom: 3px solid #1e3a8a;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                  }
                  .section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background: #f9fafb;
                    border-radius: 8px;
                  }
                  .score-box {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    margin-bottom: 20px;
                  }
                  .score-box h2 {
                    color: white;
                    margin: 0 0 10px 0;
                  }
                  .score {
                    font-size: 48px;
                    font-weight: bold;
                  }
                  .essay-content {
                    background: white;
                    padding: 15px;
                    border-left: 4px solid #3b82f6;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                  }
                  .submission-section {
                    margin-bottom: 40px;
                  }
                  @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                  }
                </style>
              </head>
              <body>
                <div class="no-print" style="text-align: center; padding: 20px; background: #f0f9ff; border-radius: 10px; margin-bottom: 30px;">
                  <h2 style="color: #1e3a8a; margin-bottom: 10px;">📚 채점 결과 통합 문서</h2>
                  <p style="color: #64748b;">총 <strong>${submissions.length}개</strong>의 답안지가 포함되어 있습니다</p>
                  <button onclick="window.print()" style="padding: 12px 40px; background: #1e3a8a; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 10px;">
                    🖨️ 전체 인쇄하기
                  </button>
                  <button onclick="window.close()" style="padding: 12px 40px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-left: 10px; margin-top: 10px;">
                    닫기
                  </button>
                </div>
                
                ${combinedContent}
              </body>
              </html>
            `;
          }

          // Load user info and usage
          async function loadUserInfo() {
            try {
              // TODO: Replace with actual API call to get user info
              // For now, using dummy data
              const userName = '홍길동';
              const currentPlan = 'free'; // free, starter, basic, pro
              const usageCount = 1; // Current usage count
              
              // Plan limits and names
              const planInfo = {
                free: { name: '무료 체험', limit: 20 },
                starter: { name: '스타터', limit: 90 },
                basic: { name: '베이직', limit: 300 },
                pro: { name: '프로', limit: 600 }
              };
              
              const plan = planInfo[currentPlan] || planInfo.free;
              
              // Update UI
              document.getElementById('usageInfo').textContent = plan.name + ': ' + usageCount + ' / ' + plan.limit;
              
              // Update upgrade link
              const upgradeLink = document.querySelector('a[href*="/pricing"]');
              if (upgradeLink) {
                upgradeLink.href = '/pricing?plan=' + currentPlan;
              }
            } catch (error) {
              console.error('Error loading user info:', error);
              document.getElementById('usageInfo').textContent = '무료 체험: 0 / 20';
            }
          }

          // Initial load
          // Logout function
          function toggleTeacherProfileMenu() {
            const menu = document.getElementById('teacherProfileMenu');
            menu.classList.toggle('hidden');
          }
          
          // Close profile menu when clicking outside
          document.addEventListener('click', function(event) {
            const profileButton = document.getElementById('teacherProfileButton');
            const profileMenu = document.getElementById('teacherProfileMenu');
            
            if (profileButton && profileMenu && 
                !profileButton.contains(event.target) && 
                !profileMenu.contains(event.target)) {
              profileMenu.classList.add('hidden');
            }
          });
          
          function logout() {
            if (!confirm('로그아웃하시겠습니까?')) {
              return;
            }
            
            // Clear all storage data
            removeStorageItem('session_id');
            removeStorageItem('user_name');
            removeStorageItem('user_email');
            removeStorageItem('isLoggedIn');
            removeStorageItem('student_session_id');
            removeStorageItem('student_name');
            removeStorageItem('student_email');
            removeStorageItem('student_grade_level');
            removeStorageItem('isStudentLoggedIn');
            
            // Redirect to home page
            window.location.href = '/';
          }
          
          // Close profile dropdown when clicking outside
          document.addEventListener('click', function(event) {
            const profileDropdown = document.querySelector('.profile-dropdown');
            if (profileDropdown && !profileDropdown.contains(event.target)) {
              const menu = document.querySelector('.profile-dropdown-menu');
              if (menu && !menu.classList.contains('hidden')) {
                // Optional: add logic to close dropdown
              }
            }
          });
          
          // Page initialization is now handled by initializeAxios()
          // loadUserInfo(), loadPlatformRubrics(), loadAssignments() are called after axios is ready
          
          // === Markdown Preview Functions ===
          
          // Simple Markdown to HTML converter (supports images and basic formatting)
          function simpleMarkdownToHtml(markdown) {
            if (!markdown || markdown.trim() === '') {
              return '<p class="text-gray-400 text-xs">미리보기가 여기에 표시됩니다</p>';
            }
            
            let html = markdown;
            
            // Convert images: ![alt](url) -> <img>
            html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, url) {
              return `<img src="${url}" alt="${alt}" class="max-w-full h-auto rounded border border-gray-200 my-2" style="max-height: 300px;" />`;
            });
            
            // Convert links: [text](url) -> <a>
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>');
            
            // Convert bold: **text** or __text__ -> <strong>
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            
            // Convert italic: *text* or _text_ -> <em>
            html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
            
            // Convert line breaks
            html = html.replace(/\n/g, '<br>');
            
            return html;
          }
          
          // Toggle preview visibility
          function toggleReferencePreview(button) {
            const referenceItem = button.closest('.reference-item');
            const previewDiv = referenceItem.querySelector('.reference-preview');
            const textarea = referenceItem.querySelector('.reference-input');
            
            if (previewDiv.style.display === 'none') {
              // Show preview
              previewDiv.style.display = 'block';
              textarea.classList.remove('rounded-lg');
              textarea.classList.add('rounded-t-lg');
              button.innerHTML = '<i class="fas fa-eye-slash mr-1"></i>미리보기 숨기기';
              
              // Update preview content
              updateReferencePreview(textarea);
            } else {
              // Hide preview
              previewDiv.style.display = 'none';
              textarea.classList.remove('rounded-t-lg');
              textarea.classList.add('rounded-lg');
              button.innerHTML = '<i class="fas fa-eye mr-1"></i>미리보기';
            }
          }
          
          // Update preview content when textarea changes
          function updateReferencePreview(textarea) {
            const referenceItem = textarea.closest('.reference-item');
            const previewDiv = referenceItem.querySelector('.reference-preview');
            
            if (previewDiv && previewDiv.style.display !== 'none') {
              const markdownText = textarea.value;
              const htmlContent = simpleMarkdownToHtml(markdownText);
              previewDiv.innerHTML = htmlContent;
            }
          }
          
          // Make functions globally accessible
          window.toggleReferencePreview = toggleReferencePreview;
          window.updateReferencePreview = updateReferencePreview;

          // Register assignment to library
          async function registerToLibrary(assignmentId) {
            if (!confirm('이 과제를 라이브러리에 등록하시겠습니까? 등록된 과제는 모든 사용자가 볼 수 있습니다.')) {
              return;
            }

            try {
              const response = await axios.post(`/api/assignment/${assignmentId}/register-to-library`);
              if (response.data.success) {
                alert('과제가 라이브러리에 등록되었습니다!');
              }
            } catch (error) {
              console.error('Error registering to library:', error);
              alert('라이브러리 등록에 실패했습니다: ' + (error.response?.data?.error || error.message));
            }
          }
          
          window.registerToLibrary = registerToLibrary;

          // Library Modal Functions
          let libraryAssignments = [];
          let filteredLibraryAssignments = [];
          
          async function openLibraryModal() {
            document.getElementById('libraryModal').classList.remove('hidden');
            await loadLibraryAssignments();
          }
          
          function closeLibraryModal() {
            document.getElementById('libraryModal').classList.add('hidden');
          }
          
          async function loadLibraryAssignments() {
            try {
              const token = getStorageItem('token');
              
              // Load tags first
              const tagsResponse = await axios.get('/api/library/tags', {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              const tagSelect = document.getElementById('libraryFilterTag');
              tagSelect.innerHTML = '<option value="">전체</option>';
              (tagsResponse.data.tags || []).forEach(tag => {
                tagSelect.innerHTML += `<option value="${tag.tag}">${tag.tag} (${tag.count})</option>`;
              });
              
              // Load assignments
              await filterLibrary();
            } catch (error) {
              console.error('Error loading library:', error);
              document.getElementById('libraryList').innerHTML = `
                <div class="text-center py-8 text-red-600">
                  <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                  <p>라이브러리를 불러오는데 실패했습니다.</p>
                </div>
              `;
            }
          }
          
          async function filterLibrary() {
            try {
              const token = getStorageItem('token');
              const authorType = document.getElementById('libraryFilterAuthorType').value;
              const grade = document.getElementById('libraryFilterGrade').value;
              const subject = document.getElementById('libraryFilterSubject').value;
              const tag = document.getElementById('libraryFilterTag').value;
              const search = document.getElementById('librarySearch').value;
              const sortBy = document.getElementById('librarySortBy').value;
              
              // Build query parameters
              const params = new URLSearchParams();
              if (authorType) params.append('author', authorType);
              if (grade) params.append('gradeLevel', grade);
              if (subject) params.append('subject', subject);
              if (tag) params.append('tag', tag);
              if (search) params.append('search', search);
              if (sortBy) params.append('sortBy', sortBy);
              params.append('sortOrder', 'DESC');
              
              const response = await axios.get(`/api/library/assignments?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              filteredLibraryAssignments = response.data.assignments || [];
              renderLibraryList();
            } catch (error) {
              console.error('Error filtering library:', error);
            }
          }
          
          function sortLibrary() {
            filterLibrary(); // Re-fetch with new sort
          }
          
          function handleSearchKeyup(event) {
            if (event.key === 'Enter') {
              filterLibrary();
            }
          }
          
          function renderLibraryList() {
            const libraryList = document.getElementById('libraryList');
            
            if (filteredLibraryAssignments.length === 0) {
              libraryList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                  <i class="fas fa-inbox text-3xl mb-3"></i>
                  <p>조건에 맞는 과제가 없습니다.</p>
                </div>
              `;
              return;
            }
            
            libraryList.innerHTML = filteredLibraryAssignments.map(assignment => {
              // Generate star rating HTML
              const rating = assignment.average_rating || 0;
              const fullStars = Math.floor(rating);
              const halfStar = rating % 1 >= 0.5;
              const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
              
              let starsHtml = '';
              for (let i = 0; i < fullStars; i++) {
                starsHtml += '<i class="fas fa-star text-yellow-500"></i>';
              }
              if (halfStar) {
                starsHtml += '<i class="fas fa-star-half-alt text-yellow-500"></i>';
              }
              for (let i = 0; i < emptyStars; i++) {
                starsHtml += '<i class="far fa-star text-yellow-500"></i>';
              }
              
              // Generate tags HTML
              const tagsHtml = (assignment.tags || []).map(tag => 
                `<span class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                  <i class="fas fa-tag mr-1"></i>${tag}
                </span>`
              ).join('');
              
              return `
              <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 mb-2">${assignment.title}</h3>
                    <p class="text-sm text-gray-600 mb-3 line-clamp-2">${assignment.description}</p>
                    
                    <!-- Statistics -->
                    <div class="flex items-center gap-4 mb-2">
                      <div class="flex items-center">
                        ${starsHtml}
                        <span class="ml-1 text-sm text-gray-600">${rating.toFixed(1)} (${assignment.rating_count || 0})</span>
                      </div>
                      <span class="text-sm text-gray-600">
                        <i class="fas fa-download mr-1"></i>${assignment.usage_count || 0}회 사용
                      </span>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 text-xs">
                      <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        <i class="fas fa-user mr-1"></i>${assignment.author_name}
                      </span>
                      <span class="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                        <i class="fas fa-graduation-cap mr-1"></i>${assignment.grade_level}
                      </span>
                      ${assignment.subject ? `
                        <span class="px-2 py-1 bg-green-100 text-green-800 rounded">
                          <i class="fas fa-book mr-1"></i>${assignment.subject}
                        </span>
                      ` : ''}
                      <span class="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                        <i class="fas fa-calendar mr-1"></i>${new Date(assignment.created_at).toLocaleDateString()}
                      </span>
                      ${tagsHtml}
                    </div>
                  </div>
                  <button 
                    onclick="loadFromLibrary(${assignment.id})" 
                    class="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm whitespace-nowrap"
                  >
                    <i class="fas fa-download mr-2"></i>불러오기
                  </button>
                </div>
              </div>
            `;
            }).join('');
          }
                    class="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm whitespace-nowrap"
                  >
                    <i class="fas fa-download mr-2"></i>불러오기
                  </button>
                </div>
              </div>
            `).join('');
          }
          
          async function loadFromLibrary(assignmentId) {
            try {
              const token = getStorageItem('token');
              const response = await axios.get(`/api/assignment/${assignmentId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              const assignment = response.data;
              
              // Increment usage count
              try {
                await axios.post(`/api/assignment/${assignmentId}/increment-usage`, {}, {
                  headers: { Authorization: `Bearer ${token}` }
                });
              } catch (err) {
                console.error('Failed to increment usage count:', err);
              }
              
              // Fill form with library assignment data
              document.getElementById('assignmentTitle').value = assignment.title + ' (복사본)';
              document.getElementById('assignmentDescription').value = assignment.description;
              document.getElementById('assignmentGradeLevel').value = assignment.grade_level || '';
              document.getElementById('assignmentSubject').value = assignment.subject || '';
              document.getElementById('assignmentDueDate').value = assignment.due_date ? assignment.due_date.split('T')[0] : '';
              
              // Load prompts if available
              if (assignment.prompts && assignment.prompts.length > 0) {
                const referenceMaterials = document.getElementById('assignmentReferenceMaterials');
                referenceMaterials.innerHTML = '';
                assignment.prompts.forEach((prompt, index) => {
                  const referenceItem = createReferenceItem(prompt);
                  referenceMaterials.appendChild(referenceItem);
                });
              }
              
              closeLibraryModal();
              alert('라이브러리에서 과제를 불러왔습니다. 내용을 수정하여 사용하세요.');
            } catch (error) {
              console.error('Error loading from library:', error);
              alert('과제를 불러오는데 실패했습니다: ' + (error.response?.data?.error || error.message));
            }
          }
          
          function createReferenceItem(content = '') {
            const div = document.createElement('div');
            div.className = 'reference-item';
            div.innerHTML = `
              <div class="flex gap-2 mb-2">
                <textarea class="reference-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm overflow-y-auto" rows="5" placeholder="제시문 내용 (선택사항)">${content}</textarea>
                <button type="button" onclick="removeReferenceMaterial(this)" class="px-3 py-2 text-red-600 hover:text-red-800 text-sm self-start">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `;
            return div;
          }
          
          window.openLibraryModal = openLibraryModal;
          window.closeLibraryModal = closeLibraryModal;
          window.filterLibrary = filterLibrary;
          window.sortLibrary = sortLibrary;
          window.handleSearchKeyup = handleSearchKeyup;
          window.loadFromLibrary = loadFromLibrary;

  }); // end window.addEventListener('load')
} // end else (session exists)
