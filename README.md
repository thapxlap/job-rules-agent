# 무엇이든 물어보세요 — Firebase RAG MVP

사내 문서를 업로드하면 자동으로 청킹·임베딩하여 Firestore Vector Search에 저장하고, 일반 사용자가 로그인 화면 없이 질문할 수 있는 Firebase/GCP 기반 MVP입니다.

## 포함 기능

- 일반 사용자: Firebase 익명 인증, 문서 기반 질문, 스트리밍 답변, 출처 원문 열기
- 관리자: Google 로그인, PDF·DOCX·TXT·MD 업로드, 공개 범위 지정, 색인 상태 확인
- 문서 처리: Cloud Storage 트리거, 텍스트 추출, 구조 기반 청킹, Vertex AI 임베딩
- 검색·생성: Firestore Vector Search, Vertex AI Gemini, 서버 측 권한 필터
- 보안: 관리자 Custom Claim, Firestore·Storage Rules, 원본 5분 서명 URL

## 아키텍처

```text
Next.js / Firebase App Hosting
├─ /        익명 사용자 챗봇
├─ /admin   관리자 문서 업로드
└─ /api     ID Token 검증·검색·Gemini 스트리밍

Firebase / Google Cloud
├─ Authentication  익명 + Google 로그인
├─ Cloud Storage   원본 문서
├─ Cloud Functions 업로드 트리거·문서 색인
├─ Firestore       문서 상태·청크·벡터
└─ Vertex AI       임베딩·답변 생성
```

## 1. 사전 준비

1. Firebase 프로젝트를 만들고 Blaze 요금제로 전환합니다.
2. Firestore Database와 Cloud Storage를 생성합니다.
3. Firebase Authentication에서 `Anonymous`와 `Google` 공급자를 활성화합니다.
4. Google Cloud Console에서 Vertex AI API를 활성화합니다.
5. Firebase 웹 앱을 등록하고 `.env.example`을 `.env.local`로 복사하여 값을 입력합니다.
6. `.firebaserc.example`을 `.firebaserc`로 복사하고 프로젝트 ID를 입력합니다.

권장 데이터 위치는 회사 정책에 따라 먼저 결정하세요. Storage 버킷과 Cloud Functions 트리거 리전이 맞아야 합니다. 기본 함수 리전은 `asia-northeast3`이며 필요하면 배포 환경의 `FUNCTION_REGION`을 변경합니다. Vertex AI 모델 위치 지원 여부는 별도로 확인해야 합니다.

## 2. 로컬 도구

- Node.js 22
- pnpm 10+
- Firebase CLI
- Google Cloud CLI

```powershell
pnpm install
firebase login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

## 3. 로컬 환경변수

`.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_BUCKET
NEXT_PUBLIC_FIREBASE_APP_ID=...

GOOGLE_CLOUD_PROJECT=YOUR_PROJECT
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSION=1024
```

Firebase 웹 API 키는 클라이언트 식별 설정이며 서버 비밀키로 취급하지 않습니다. 실제 접근 제어는 Authentication, App Check, Security Rules, 서버의 ID Token 검증으로 수행합니다.

## 4. 관리자 지정

관리자 후보 사용자가 `/admin`에서 Google 로그인을 한 번 완료한 뒤 실행합니다.

```powershell
$env:GOOGLE_CLOUD_PROJECT='YOUR_PROJECT_ID'
pnpm admin:set admin@company.com
```

설정 후 해당 사용자는 로그아웃했다가 다시 로그인해야 새 Custom Claim이 적용됩니다.

## 5. 벡터 인덱스 생성

Firestore Vector Search는 Console이 아니라 `gcloud`로 인덱스를 생성합니다.

```powershell
.\scripts\create-vector-index.ps1 -ProjectId 'YOUR_PROJECT_ID'
```

인덱스가 준비되기까지 몇 분이 걸릴 수 있습니다. 임베딩 차원을 바꾸면 스크립트의 dimension과 `EMBEDDING_DIMENSION`을 함께 변경해야 합니다. Firestore의 최대 벡터 차원은 2,048이며 이 프로젝트는 1,024를 사용합니다.

## 6. 배포

Rules와 Functions:

```powershell
firebase deploy --only firestore:rules,storage,functions
```

웹은 Firebase Console의 App Hosting에서 GitHub 저장소와 운영 브랜치를 연결합니다. `apphosting.yaml`의 런타임 환경변수와 App Hosting 설정의 `NEXT_PUBLIC_FIREBASE_*`, `GOOGLE_CLOUD_PROJECT` 값을 등록합니다.

서비스 계정에는 최소한 다음 권한이 필요합니다.

- App Hosting 런타임: Firebase Authentication 토큰 확인, Firestore 읽기, Vertex AI 호출, Storage 서명 URL 생성
- 색인 함수: Storage Object Viewer, Firestore User, Vertex AI User

프로젝트 전체 Editor 역할을 부여하는 대신 전용 서비스 계정과 최소 권한을 사용하세요.

## 7. 로컬 실행과 검증

```powershell
pnpm dev
pnpm check
```

로컬에서 실제 Vertex AI를 호출하려면 Application Default Credentials와 `GOOGLE_CLOUD_PROJECT`가 필요합니다. Firebase Emulator를 사용하려면 클라이언트 SDK의 emulator 연결 코드를 개발 환경에서 추가하거나 실제 개발용 Firebase 프로젝트를 사용하세요.

## 공개 범위

- `COMPANY`: 익명 사용자를 포함한 모든 챗봇 사용자
- `DEPARTMENT:HR`: ID Token의 `departmentId=HR` 사용자인 경우
- `ADMIN`: `admin=true` 사용자만

현재 MVP의 `COMPANY`는 사실상 공개 지식 범위입니다. 사내 기밀 문서는 `COMPANY`로 업로드하면 안 됩니다. 실제 임직원 전용으로 운영할 때는 익명 인증을 제거하고 회사 SSO를 연결한 뒤, `COMPANY`를 인증된 임직원에게만 허용하도록 변경해야 합니다.

## MVP 제한사항과 다음 단계

- 스캔 PDF OCR은 아직 포함하지 않았습니다. 텍스트 추출이 부족하면 `FAILED` 상태로 표시됩니다.
- PPTX·XLSX는 지원하지 않습니다.
- 문서 삭제·재처리 UI는 다음 단계입니다.
- 질문·답변 이력을 기본 저장하지 않아 개인정보 수집을 줄였습니다.
- 운영 공개 전 Firebase App Check, API rate limit, 예산 알림을 추가해야 합니다.
- 부서 권한을 사용하려면 신뢰할 수 있는 서버에서 `departmentId` Custom Claim을 설정해야 합니다.

## 주요 디렉터리

```text
app/                    Next.js 화면과 API
lib/firebase/           Firebase 클라이언트
lib/server/             인증·권한·Vertex AI·Firestore 서버 코드
functions/src/          문서 파싱·청킹·임베딩 함수
scripts/                관리자 지정·벡터 인덱스 생성
firestore.rules         Firestore 접근 제어
storage.rules           업로드 파일 접근 제어
```
