// Password Reset Page JavaScript
// VERSION: Extracted from inline script to fix HTML parsing issues

console.log('🚀 Password Reset Page - External JS Loaded');

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// Add axios interceptor to detect HTML responses
if (typeof axios !== 'undefined') {
  console.log('✅ Axios loaded successfully');
  axios.interceptors.response.use(
    response => {
      // Check if API returned HTML instead of JSON
      if (typeof response.data === 'string' && 
          (response.data.trim().startsWith('<!DOCTYPE') || 
           response.data.trim().startsWith('<html'))) {
        console.error('❌ API returned HTML instead of JSON!');
        throw new Error('HTML_RESPONSE_FROM_API');
      }
      return response;
    },
    error => {
      console.error('Axios interceptor error:', error);
      return Promise.reject(error);
    }
  );
} else {
  console.error('❌ Axios NOT loaded');
}

// Validate token on page load
async function validateToken() {
  // Always ensure loading state is eventually cleared
  const loadingTimeout = setTimeout(() => {
    console.error('⏱️ Validation timeout - forcing expired state');
    showExpiredState();
  }, 10000); // 10 second timeout

  try {
    if (!token) {
      console.error('❌ No token found in URL');
      clearTimeout(loadingTimeout);
      showExpiredState();
      return;
    }

    console.log('🔍 Validating token:', token);

    // Wait for axios to be loaded
    if (typeof axios === 'undefined') {
      console.error('⚠️ Axios is not loaded yet, waiting...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (typeof axios === 'undefined') {
        console.error('❌ Axios still not loaded after waiting');
        clearTimeout(loadingTimeout);
        showExpiredState();
        return;
      }
    }

    // Validate token by checking if it exists and is not expired
    console.log('📤 Sending POST request to /api/auth/validate-reset-token');
    const response = await axios.post('/api/auth/validate-reset-token', { token }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });
    
    console.log('📥 API Response:', response.data);
    
    clearTimeout(loadingTimeout);
    
    if (response?.data?.valid === true) {
      console.log('✅ Token is valid, showing reset form');
      showResetForm();
    } else {
      console.log('❌ Token is invalid:', response?.data?.error);
      showExpiredState();
    }
  } catch (error) {
    clearTimeout(loadingTimeout);
    console.error('❌ Token validation error:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error response:', error?.response);
    console.error('Error status:', error?.response?.status);
    console.error('Error data:', error?.response?.data);
    
    // Always show expired state on any error
    showExpiredState();
  }
}

function showResetForm() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('expiredState').classList.add('hidden');
  document.getElementById('resetForm').classList.remove('hidden');
  document.getElementById('successState').classList.add('hidden');
}

function showExpiredState() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('expiredState').classList.remove('hidden');
  document.getElementById('resetForm').classList.add('hidden');
  document.getElementById('successState').classList.add('hidden');
}

function showSuccessState() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('expiredState').classList.add('hidden');
  document.getElementById('resetForm').classList.add('hidden');
  document.getElementById('successState').classList.remove('hidden');
}

async function handleResetPassword(event) {
  event.preventDefault();
  
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }

  // Validate password length
  if (newPassword.length < 10) {
    alert('비밀번호는 최소 10자 이상이어야 합니다.');
    return;
  }

  // Validate password complexity
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  // Note: No need to escape backtick in external JS file!
  const hasSpecial = /[@$!%*?&#^()_+=\-[\]{}|\\:;"'<>,./~`]/.test(newPassword);

  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
    alert('비밀번호는 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개씩 포함해야 합니다.');
    return;
  }

  try {
    const response = await axios.post('/api/auth/reset-password', {
      token,
      new_password: newPassword
    });

    if (response.data.success) {
      showSuccessState();
    }
  } catch (error) {
    if (error.response?.status === 400) {
      showExpiredState();
    } else {
      alert('비밀번호 재설정 실패: ' + (error.response?.data?.error || error.message));
    }
  }
}

// Validate token on page load - wait for axios to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', validateToken);
} else {
  // DOM is already loaded
  validateToken();
}
