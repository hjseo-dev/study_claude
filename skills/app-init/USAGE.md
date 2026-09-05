# 사용 예시: app-init

## 시나리오

지금까지 준비한 것:
- tech-stack 완료 (React Native + Spring Boot + PostgreSQL)
- design-base-color 완료 (치즈 오렌지 팔레트)
- 프로젝트 레포: wlabs-catizen (GitHub 준비됨)

"이제 실제 코드를 짜기 위해 폴더 구조랑 기본 설정들을 자동으로 만들어줘"

## 실행

```
/wlabs:app-init
```

## 진행 과정

### 1단계: 선행 조건 확인
```
확인 사항:
✓ docs/tech-stack.md 존재
✓ docs/color-palettes.json 존재  
✓ Node.js 21.x 설치됨
✓ Java 21 설치됨
✓ PostgreSQL 15 설치됨
```

### 2단계: 프로젝트 구성 옵션
```
질문:
- 프론트엔드 폴더명? → "app" (기본값 사용)
- 백엔드 폴더명? → "backend" (기본값 사용)
- PostgreSQL 포트? → 5432 (기본값)
- Spring Boot 포트? → 8080 (기본값)
```

### 3단계: 자동 생성
```bash
# 폴더 구조 생성
wlabs-catizen/
├─ app/
│  ├─ src/screens/
│  ├─ src/components/
│  ├─ src/hooks/
│  ├─ src/services/
│  ├─ src/types/
│  ├─ src/styles/
│  ├─ src/utils/
│  ├─ src/App.tsx
│  ├─ app.json
│  ├─ tsconfig.json
│  ├─ tailwind.config.js (브랜드 컬러 포함)
│  ├─ package.json
│  ├─ .env.example
│  └─ .gitignore
├─ backend/
│  ├─ src/main/java/com/example/catizen/
│  │  ├─ controller/
│  │  ├─ service/
│  │  ├─ repository/
│  │  ├─ entity/
│  │  ├─ dto/
│  │  ├─ config/
│  │  └─ CatizenApplication.java
│  ├─ src/main/resources/
│  │  ├─ application.properties
│  │  └─ db/migration/
│  ├─ build.gradle
│  ├─ .env.example
│  └─ .gitignore
├─ docs/
│  ├─ SETUP.md
│  ├─ API.md
│  ├─ DATABASE.md
│  └─ ARCHITECTURE.md
├─ docker-compose.yml
├─ .env.example (루트)
├─ .gitignore
└─ .claude/CLAUDE.md
```

### 4단계: 환경 변수 설정
```bash
# 프로젝트 루트의 .env 파일 생성 (사용자가 직접)
EXPO_PUBLIC_API_URL=http://localhost:8080/api
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_jwt_secret_key
```

### 5단계: 검증 및 초기 설치
```bash
# PostgreSQL 컨테이너 실행
docker-compose up -d

# 프론트엔드 의존성 설치
cd app
npm install

# 백엔드 의존성 설치
cd backend
./gradlew build --exclude-task test

# 프론트엔드 실행 (별도 터미널)
npm start

# 백엔드 실행 (별도 터미널)
./gradlew bootRun
```

## 생성되는 특징

### 브랜드 컬러 자동 적용
tailwind.config.js에 이미 적용됨:
```javascript
colors: {
  primary: "#B8621B",      // 메인 포인트
  secondary: "#E8A25D",    // 보조
  accent: "#FDECD8",       // 연배경
  dark: "#292524",         // 검정 포인트
  bg: "#FAFAF9",           // 기본 배경
}
```

프론트에서 바로 사용:
```jsx
<View className="bg-primary p-4">
  <Text className="text-white font-bold">중요 버튼</Text>
</View>
```

### 백엔드 DB 설정 자동화
application.properties 기본값:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/catizen_db
spring.datasource.username=postgres
spring.jpa.hibernate.ddl-auto=validate
```

### API 연결 준비
src/services/api.ts에 BaseURL 이미 설정됨:
```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";
```

## 다음 단계

1. 기본 엔티티/컨트롤러 추가 (phase-4 개발)
2. 화면 컴포넌트 구현 (phase-6 UI 개발)
3. 테스트 작성
4. 배포 설정 (Docker, AWS)

## 주의사항

- .env 파일은 .gitignore에 포함됨 (보안)
- 첫 npm install은 5~10분 소요
- 첫 gradle build는 10~15분 소요
- PostgreSQL이 실행 중이어야 Spring Boot 정상 시작됨
