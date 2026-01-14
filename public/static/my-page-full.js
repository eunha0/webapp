// My Page - Complete Functionality
// Simple test version

console.log('===  my-page-full.js loaded ===');

// Check if storage functions are available
console.log('[DEBUG] window.getStorageItem available:', typeof window.getStorageItem);
console.log('[DEBUG] window.setStorageItem available:', typeof window.setStorageItem);

// Session check
const sessionId = window.getStorageItem ? window.getStorageItem('session_id') : null;
console.log('[DEBUG] Session ID:', sessionId ? 'EXISTS' : 'NULL');

if (!sessionId) {
  console.error('[DEBUG] No session ID found! User needs to log in.');
  alert('로그인이 필요합니다.');
  window.location.href = '/login';
} else {
  console.log('[DEBUG] Session ID verified! Initializing page...');
  
  // Wait for page to fully load
  window.addEventListener('load', function() {
    console.log('[DEBUG] Page fully loaded! Starting initialization...');
    
    // Test: Show a simple message
    const container = document.getElementById('assignmentsList');
    if (container) {
      container.innerHTML = '<div class="text-center py-12"><h2 class="text-2xl font-bold">My Page is working!</h2><p class="mt-4">Full functionality will be restored shortly.</p></div>';
      console.log('[DEBUG] Test message displayed successfully');
    } else {
      console.error('[DEBUG] Container #assignmentsList not found!');
    }
  });
}

console.log('=== my-page-full.js initialization complete ===');
