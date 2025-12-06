# 테스트 계정 정보

## 📋 계정 목록

### 교사 계정
- **이메일**: `teacher@test.com`
- **비밀번호**: `password123`
- **이름**: 테스트 교사
- **로그인 URL**: https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai/login

### 학생 계정
- **이메일**: `student@test.com`
- **비밀번호**: `password123`
- **이름**: 테스트 학생
- **학년**: 고등학교 1학년
- **로그인 URL**: https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai/student/login

## 🔐 비밀번호 해시 방식

현재 시스템은 **Base64 인코딩** 방식을 사용합니다:
```javascript
// src/index.tsx:630
const passwordHash = btoa(password)
```

- `password123` → Base64: `cGFzc3dvcmQxMjM=`
- 프로덕션에서는 bcrypt 등 강력한 해싱 알고리즘 사용 권장

## ✅ 로그인 테스트 결과

### 교사 로그인 테스트
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"password123"}'

# 결과: ✅ 성공
{
  "success": true,
  "session_id": "cc6c0af2-b9ef-4998-87cb-db624d2ddf96",
  "user": {
    "id": 1,
    "name": "테스트 교사",
    "email": "teacher@test.com"
  }
}
```

### 학생 로그인 테스트
```bash
curl -X POST http://localhost:3000/api/student/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"password123"}'

# 결과: ✅ 성공
{
  "success": true,
  "session_id": "782ccd2a-a3b2-4beb-8f7a-7ed18cbcba3e",
  "student": {
    "id": 1,
    "name": "테스트 학생",
    "email": "student@test.com",
    "grade_level": "고등학교 1학년"
  }
}
```

## 📦 샘플 데이터

### 테스트 과제
- **제목**: 테스트 과제 - 환경 보호
- **설명**: 환경 보호의 중요성에 대해 논술하세요.
- **학년**: 고등학교
- **액세스 코드**: `123456` ⭐
- **프롬프트**: 환경 보호가 왜 중요한지 설명하고, 실천 방안을 제시하세요.

### 평가 기준 (Rubrics)
1. **논리성**: 주장과 근거가 논리적으로 연결되어 있는가
2. **창의성**: 독창적인 관점과 아이디어를 제시했는가
3. **표현력**: 문장 구성과 어휘 사용이 적절한가

## 🧪 전체 플로우 테스트

### 1단계: 학생 로그인
1. https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai/student/login 접속
2. 이메일: `student@test.com`
3. 비밀번호: `password123`
4. "로그인" 버튼 클릭
5. ✅ 학생 대시보드로 리다이렉트

### 2단계: 액세스 코드로 과제 조회
1. 학생 대시보드에서 "과제 액세스 코드 입력" 섹션 찾기
2. 액세스 코드 입력: `123456`
3. "코드 확인" 버튼 클릭
4. ✅ 과제 정보 표시 (제목, 프롬프트, 평가 기준)

### 3단계: 답안 제출
1. "답안 작성" 섹션에 답안 입력:
   ```
   환경 보호는 지구의 미래를 위해 매우 중요합니다.
   기후 변화, 생물 다양성 감소, 자원 고갈 등의 문제를 해결하기 위해서는
   개인과 사회 모두의 노력이 필요합니다.
   
   실천 방안:
   1. 일회용품 사용 줄이기
   2. 분리수거 철저히 하기
   3. 대중교통 이용하기
   4. 에너지 절약하기
   ```
2. "답안 제출하기" 버튼 클릭
3. ✅ "답안이 제출되었습니다!" 메시지 확인

### 4단계: 교사 확인
1. https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai/login 접속
2. 이메일: `teacher@test.com`
3. 비밀번호: `password123`
4. "나의 페이지" 클릭
5. 과제 카드 클릭
6. "제출된 답안 보기" 클릭
7. ✅ 학생이 제출한 답안 확인

## 🔧 데이터베이스 초기화 (필요시)

로컬 개발 환경에서 데이터를 초기화하고 싶을 때:

```bash
# 데이터베이스 삭제
cd /home/user/webapp-ai
rm -rf .wrangler/state/v3/d1

# 마이그레이션 재적용
npx wrangler d1 migrations apply webapp-production --local

# 테스트 데이터 추가
npx wrangler d1 execute webapp-production --local --file=./seed.sql

# 서비스 재시작
fuser -k 3000/tcp 2>/dev/null || true
pm2 delete webapp
pm2 start ecosystem.config.cjs
```

## 📝 주의사항

### 로컬 개발 환경
- 로컬 데이터베이스는 `.wrangler/state/v3/d1/`에 저장됨
- 서비스 재시작 시 데이터가 초기화될 수 있음
- 개발 중에는 `seed.sql`로 테스트 데이터 재생성 필요

### 프로덕션 환경
- Cloudflare D1 프로덕션 데이터베이스 사용
- 데이터 영구 보존
- 초기 배포 시 `seed.sql`로 테스트 계정 생성 권장

### 보안
- ⚠️ 현재 Base64 인코딩은 **개발/테스트용**
- 프로덕션 배포 전 bcrypt 등 강력한 해싱 알고리즘으로 변경 필요
- 테스트 계정은 프로덕션에서 삭제하거나 강력한 비밀번호로 변경

## 🔗 관련 문서

- [ACCESS_CODE_FIX_SUMMARY.md](./ACCESS_CODE_FIX_SUMMARY.md) - 액세스 코드 문제 해결
- [ACCESS_CODE_SOLUTION.md](./ACCESS_CODE_SOLUTION.md) - 웹 UI 사용 가이드
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 디버깅 가이드
- [seed.sql](./seed.sql) - 테스트 데이터 스크립트

---
**최종 업데이트**: 2025-12-06
**테스트 상태**: ✅ 모든 계정 로그인 성공
**GitHub 커밋**: `9e1251c`
