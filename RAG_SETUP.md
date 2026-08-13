# RAG 환경 설정

1. Firebase 프로젝트를 생성하고 Blaze 요금제로 전환합니다.
2. Firestore, Cloud Storage, App Hosting, Cloud Functions를 활성화합니다.
3. Google Cloud Console에서 Vertex AI API를 활성화합니다.
4. `.env.example`을 `.env.local`로, `.firebaserc.example`을 `.firebaserc`로 복사하고 프로젝트 값을 채웁니다.
5. Google Cloud CLI 로그인 후 벡터 인덱스를 만듭니다.

```powershell
gcloud auth application-default login
.\scripts\create-vector-index.ps1 -ProjectId 'YOUR_PROJECT_ID'
```

RAG 데이터 흐름은 `jobRules` 규칙 원문 → 서버/Functions 청킹 → `chunks` 임베딩 저장 → 채팅 API의 벡터 검색입니다. `chunks`는 브라우저에서 직접 읽지 않습니다. `/admin` 화면은 원문 입력, 청크 미리보기, 임베딩 상태를 제공합니다.

현재 공개 MVP는 누구나 화면을 쓸 수 있지만, 쓰기는 브라우저가 아닌 서버 API를 통해서만 처리합니다. 공개 배포 전에는 이 API에 App Check와 rate limit을 추가하세요.
