# 학생 답안 제출 오류 해결 가이드

## 문제 증상
학생이 답안 제출 시 "유효하지 않은 액세스 코드입니다" 에러 발생

## 원인
1. 액세스 코드가 데이터베이스에 존재하지 않음
2. 로컬 데이터베이스가 재시작되면서 초기화됨
3. 교사가 액세스 코드를 생성하지 않음

## 해결 방법

### 방법 1: 교사 계정으로 액세스 코드 재생성

1. **교사 계정으로 로그인**
   - URL: `https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai/login`
   - 이메일: `teacher@test.com`
   - 비밀번호: `test1234`
   
   > 만약 로그인 실패 시 회원가입 필요: `/signup`

2. **나의 페이지로 이동**
   - 로그인 후 자동으로 `/my-page`로 이동

3. **새 과제 생성** (기존 과제가 없는 경우)
   - "새 과제 만들기" 버튼 클릭
   - 과제 정보 입력:
     - 제목: "테스트 과제"
     - 설명: "답안 제출 테스트용"
     - 학년: 고등학교 1학년
     - 루브릭: 기본 4개 사용
   - "과제 생성" 버튼 클릭

4. **액세스 코드 생성**
   - 과제 카드 클릭하여 상세 페이지 열기
   - "액세스 코드 생성" 버튼 클릭
   - 6자리 숫자 코드 확인 (예: 123456)
   - **이 코드를 메모하거나 복사**

5. **학생에게 코드 전달**
   - 화면에 표시된 액세스 코드를 학생에게 알려주기

### 방법 2: 학생 계정으로 테스트

1. **학생 계정으로 로그인**
   - URL: `https://3000-iigjpsbl85aj2ml3n1x69-cbeee0f9.sandbox.novita.ai/student/login`
   - 이메일: `student@test.com`
   - 비밀번호: `test1234`
   
   > 만약 로그인 실패 시 회원가입 필요: `/student/signup`

2. **학생 대시보드에서 액세스 코드 입력**
   - 교사로부터 받은 6자리 코드 입력
   - "과제 확인" 버튼 클릭

3. **과제 정보 확인**
   - 과제 제목, 설명, 루브릭 기준 표시됨
   - "답안 작성" 텍스트 박스에 답안 입력

4. **답안 제출**
   - "답안 제출하기" 버튼 클릭
   - 성공 메시지 확인: "답안이 제출되었습니다!"

## 디버그 로그 확인

개발 환경에서 문제를 진단하려면:

```bash
# PM2 로그 실시간 확인
pm2 logs webapp --lines 50

# 학생 제출 API 디버그 로그 확인
pm2 logs webapp --nostream --lines 100 | grep DEBUG
```

디버그 로그 예시:
```
[DEBUG] Student submit - access_code: 123456, student_id: 1
[DEBUG] Assignment found: { id: 1 }
[DEBUG] Code exists check: { access_code: '123456', assignment_id: 1 }
```

만약 다음과 같은 로그가 나온다면:
```
[DEBUG] Code exists check: null
```
→ **액세스 코드가 데이터베이스에 없음** (교사가 코드 생성 필요)

## 데이터베이스 초기화 (최후의 수단)

모든 데이터를 삭제하고 깨끗하게 시작하려면:

```bash
cd /home/user/webapp-ai
npm run db:reset
```

**주의**: 모든 과제, 제출물, 사용자 데이터가 삭제됩니다!

초기화 후:
1. 교사 계정 재생성
2. 학생 계정 재생성
3. 과제 생성
4. 액세스 코드 생성

## 커밋 및 배포

문제 해결 후:

```bash
cd /home/user/webapp-ai
git add -A
git commit -m "학생 답안 제출 오류 해결"
git push origin main
```

## 연락처

추가 지원이 필요한 경우 GitHub Issues에 문의하세요.
