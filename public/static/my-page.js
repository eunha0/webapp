// CRITICAL: Session management must be first
const sessionId = localStorage.getItem('session_id');
if (!sessionId) {
  alert('로그인이 필요합니다.');
  window.location.href = '/login';
  throw new Error('No session'); // Stop execution
}

let currentAssignmentId = null;
let criterionCounter = 0;

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
        localStorage.removeItem('session_id');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

async function loadAssignments() {
  try {
    console.log('=== loadAssignments() called ===');
    const response = await axios.get('/api/assignments');
    const assignments = response.data;
    console.log('Assignments loaded:', assignments);

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

// Initial page load
console.log('=== Page loaded, calling loadAssignments ===');
document.addEventListener('DOMContentLoaded', function() {
  console.log('=== DOM loaded ===');
  loadAssignments();
});

// Also call immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  // Loading hasn't finished yet
} else {
  // DOM is already loaded
  loadAssignments();
}
