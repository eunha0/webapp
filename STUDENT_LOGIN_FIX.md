# Student Login 404 Error Fix

## 문제 설명 (Problem Description)

학생 회원가입은 정상 작동하지만, 학생 로그인 시 **"로그인 실패: Request failed with status code 404"** 에러 발생

---

## 원인 분석 (Root Cause)

**엔드포인트 경로 불일치**

### 프론트엔드 호출 (Before)
```javascript
// src/index.tsx (Line 3993) - WRONG
axios.post('/api/student/auth/login', {
  email,
  password
})
```

### 실제 라우팅 구조
```javascript
// src/index.tsx
app.route('/api/auth', auth)        // auth 라우트는 /api/auth에 마운트
app.route('/api/student', students) // student 라우트는 /api/student에 마운트

// src/routes/auth.ts
auth.post('/student/login', ...)    // 실제 경로: /api/auth/student/login
auth.post('/student/signup', ...)   // 실제 경로: /api/auth/student/signup
```

**문제**: 
- ❌ 프론트엔드: `/api/student/auth/login` (존재하지 않음)
- ✅ 실제 경로: `/api/auth/student/login`

---

## 해결 방법 (Solution)

### 수정 내용
```javascript
// src/index.tsx - FIXED
axios.post('/api/auth/student/login', {
  email,
  password
})
```

**변경 사항**:
- `/api/student/auth/login` → `/api/auth/student/login`

---

## 검증 결과 (Verification)

### API 테스트 ✅
```bash
curl -X POST http://localhost:3000/api/auth/student/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"ValidPass123!@#"}'

# Response:
{
  "success": true,
  "session_id": "fd8282f2-bb95-47a8-92d6-a5a3957a93b4",
  "student": {
    "id": 1,
    "name": "테스트 학생",
    "email": "student@test.com",
    "grade_level": "고등학교 1학년"
  }
}
```

### 브라우저 테스트 시나리오 ✅
1. 학생 회원가입 페이지에서 가입 완료
2. 학생 로그인 페이지 접속
3. 이메일과 비밀번호 입력
4. "로그인" 버튼 클릭
5. **기대 결과**:
   - ✅ 로그인 성공
   - ✅ 학생 대시보드로 이동
   - ✅ 404 에러 **없음**

---

## 학생 인증 엔드포인트 정리

모든 학생 인증 관련 엔드포인트는 `/api/auth/student/*` 경로를 사용합니다:

| 기능 | 엔드포인트 | 메서드 |
|------|-----------|--------|
| 학생 회원가입 | `/api/auth/student/signup` | POST |
| 학생 로그인 | `/api/auth/student/login` | POST |
| 학생 로그아웃 | `/api/auth/student/logout` | POST |

교사 인증 엔드포인트는 `/api/auth/*` 경로를 사용합니다:

| 기능 | 엔드포인트 | 메서드 |
|------|-----------|--------|
| 교사 회원가입 | `/api/auth/signup` | POST |
| 교사 로그인 | `/api/auth/login` | POST |
| 교사 로그아웃 | `/api/auth/logout` | POST |

---

## 배포 정보 (Deployment Info)

**GitHub Repository**: https://github.com/eunha0/webapp.git
- **최신 커밋**: `1d3628c` (fix: Correct student login endpoint path)
- **브랜치**: main

**테스트 URL**: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai
- **학생 로그인**: `/student-login`
- **학생 회원가입**: `/student-signup`

**테스트 계정**:
- 학생: `student@test.com` / `ValidPass123!@#`

---

## 테스트 방법

### 1. 브라우저 캐시 새로고침 (필수)
- **Windows**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

### 2. 학생 로그인 테스트
1. URL: https://3000-iigjpsbl85aj2ml3n1x69-5634da27.sandbox.novita.ai/student-login
2. 이메일: `student@test.com`
3. 비밀번호: `ValidPass123!@#`
4. "로그인" 버튼 클릭
5. **기대 결과**:
   - ✅ 로그인 성공 메시지
   - ✅ 학생 대시보드로 이동
   - ✅ 세션 ID가 localStorage에 저장됨

### 3. 개발자 도구 확인
- **Network 탭**: `/api/auth/student/login` → Status: `200 OK`
- **Console 탭**: 에러 메시지 **없음**

---

## 관련 수정 사항

이번 수정과 관련된 이전 수정:
1. **학생 회원가입 404 에러**: `/api/student/auth/signup` → `/api/auth/student/signup` (커밋 `c2ebd6e`)
2. **학생 로그인 404 에러**: `/api/student/auth/login` → `/api/auth/student/login` (커밋 `1d3628c`) ⭐️

두 엔드포인트 모두 같은 패턴의 오류였으며, 동일한 방식으로 해결되었습니다.

---

## 결론 (Conclusion)

**학생 로그인 404 에러가 완전히 해결되었습니다!**

✅ **학생 회원가입**: 정상 작동
✅ **학생 로그인**: 정상 작동 (수정 완료)
✅ **학생 대시보드 접근**: 정상 작동

**이제 학생들이 회원가입 후 즉시 로그인하여 과제를 제출할 수 있습니다!** 🎉

---

**Fixed on**: 2025-12-20  
**Issue**: Student login 404 error  
**Solution**: Corrected endpoint path to match route mounting  
**Status**: ✅ **완전히 해결됨 (Fully Resolved)**
