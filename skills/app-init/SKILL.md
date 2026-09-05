---
name: app-init
description: tech-stack과 design-base-color 결과물을 기반으로 React Native + Spring Boot 프로젝트의 전체 뼈대를 자동 생성. 폴더 구조, 설정 파일, 개발 환경 체크리스트까지 자동화. 실제 비즈니스 도메인 스키마/엔티티 설계는 범위 밖 — 별도 단계(예: phase-1-schema)에서 진행한다.
disable-model-invocation: false
---

# 🚀 프로젝트 뼈대 자동 생성

tech-stack과 design-base-color 스킬에서 결정한 기술과 디자인을 기반으로, React Native(Expo) 프론트엔드 + Spring Boot 백엔드 + PostgreSQL 프로젝트 전체의 초기 뼈대를 한번에 생성하는 스킬.

**범위**: 폴더 구조, 설정 파일, 빈 DB 연결까지만. 실제 도메인 테이블/엔티티(예: 특정 서비스의 비즈니스 모델)는 만들지 않는다 — 이건 사용자와 별도로 합의해야 하는 설계 결정이므로, 스킬이 임의로 채우면 안 된다.

## 0. 선행 조건

이 스킬을 실행하기 전에 다음이 준비되어야 함:

1. `/wlabs:tech-stack` 완료 → `docs/tech-stack.md` 존재
2. `/wlabs:design-base-color` 완료 → `docs/color-palettes.json` (또는 컬러 정보)
3. Node.js, Java, PostgreSQL 설치 완료

## 1. 정보 수집

스킬이 자동으로 읽을 정보:

```
프로젝트 루트/
├─ docs/tech-stack.md (기술 스택 정보)
├─ docs/color-palettes.json (브랜드 컬러)
└─ README.md (프로젝트명 등)
```

사용자에게 물어볼 것:
- 프론트엔드 폴더 이름? (기본값: `app` 또는 프로젝트명-app)
- 백엔드 폴더 이름? (기본값: `backend` 또는 프로젝트명-backend)
- PostgreSQL 로컬 포트? (기본값: 5432)
- Spring Boot 포트? (기본값: 8080)

## 2. 프론트엔드 뼈대 생성 (Expo + React Native)

### A. 프로젝트 초기화
```bash
cd {app-folder}
npx create-expo-app {project-name} --template blank-typescript
npx expo install nativewind tailwindcss react-dom react-native-web @expo/metro-runtime
npx tailwindcss init
```

### B. 폴더 구조 (빈 상태로 생성 — 도메인 파일은 넣지 않음)
```
app/
├─ src/
│  ├─ screens/          # 화면 컴포넌트 (.gitkeep만)
│  ├─ components/       # 재사용 컴포넌트 (.gitkeep만)
│  ├─ hooks/            # 커스텀 훅 (.gitkeep만)
│  ├─ services/         # API 호출
│  │  └─ api.ts         # 공통 fetch 래퍼만
│  ├─ types/            # TypeScript 타입 (.gitkeep만)
│  ├─ utils/            # 유틸리티 (.gitkeep만)
│  ├─ styles/           # 전역 스타일 + 컬러 팔레트
│  │  └─ colors.ts (브랜드 컬러)
│  └─ App.tsx           # 진입점 (브랜드 컬러 적용 확인용 기본 화면)
├─ app.json            # Expo 설정
├─ tsconfig.json       # TypeScript 설정
├─ tailwind.config.js  # NativeWind 설정 (브랜드 컬러 포함)
├─ babel.config.js, metro.config.js, global.css, nativewind-env.d.ts
├─ package.json
├─ .env.example        # 환경변수 템플릿
└─ .gitignore
```

### C. 설정 파일 자동 생성

**tailwind.config.js** (브랜드 컬러 적용, NativeWind v4)
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#색상값",
        secondary: "#색상값",
        accent: "#색상값",
        dark: "#색상값",
        bg: "#색상값",
      },
    },
  },
  plugins: [],
};
```
(색상값은 `docs/color-palettes.json`에서 그대로 가져온다)

**src/styles/colors.ts**
```typescript
export const COLORS = {
  primary: "#색상값",
  secondary: "#색상값",
  accent: "#색상값",
  dark: "#색상값",
  background: "#색상값",
} as const;
```

**src/services/api.ts** (백엔드 연결 — 공통 래퍼만, 도메인별 API 함수는 넣지 않음)
```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";

export const api = {
  get: (path: string) => fetch(`${API_BASE_URL}${path}`),
  post: (path: string, data: unknown) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  put: (path: string, data: unknown) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  delete: (path: string) => fetch(`${API_BASE_URL}${path}`, { method: "DELETE" }),
};
```

## 3. 백엔드 뼈대 생성 (Spring Boot)

### A. 프로젝트 생성

Kotlin DSL이 아니라 **Groovy DSL**(`build.gradle`)로 받는다 (`type=gradle-project`) — Kotlin 언어 자체를 안 쓰더라도 Kotlin DSL이 섞이면 혼란을 준다.

```bash
cd {backend-folder 상위}
curl -s https://start.spring.io/starter.zip \
  -d dependencies=web,data-jpa,postgresql,validation,lombok \
  -d language=java \
  -d javaVersion=21 \
  -d packageName={groupId}.{artifactId} \
  -d groupId={groupId} \
  -d artifactId={project-name} \
  -d name={project-name} \
  -d type=gradle-project \
  -o backend.zip
unzip -q backend.zip -d {backend-folder}
rm backend.zip
```

### B. 폴더 구조 (빈 패키지만 생성 — Entity/Controller는 만들지 않음)
```
backend/
├─ src/main/java/{package}/
│  ├─ controller/       # REST API 엔드포인트 (빈 폴더)
│  ├─ service/          # 비즈니스 로직 (빈 폴더)
│  ├─ repository/       # DB 접근 (빈 폴더)
│  ├─ entity/           # JPA 엔티티 (빈 폴더) — 실제 엔티티는 별도 설계 단계에서
│  ├─ dto/              # 요청/응답 DTO (빈 폴더)
│  ├─ config/           # 설정 클래스 (빈 폴더)
│  ├─ exception/        # 커스텀 예외 (빈 폴더)
│  └─ {ProjectName}Application.java  # 진입점 (Spring Initializr 기본 생성)
├─ src/main/resources/
│  └─ application.properties   # DB 연결 설정만
├─ build.gradle
├─ .env.example
└─ .gitignore
```

### C. 설정 파일 생성

**application.properties** (PostgreSQL 연결 — DB/테이블 이름만 프로젝트에 맞게, 스키마 내용은 없음)
```properties
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.datasource.url=jdbc:postgresql://localhost:5432/{project}_db
spring.datasource.username=postgres
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
server.port=8080
```

## 4. 데이터베이스 뼈대 (연결 설정까지만 — 테이블 설계는 하지 않음)

DB 자체(빈 데이터베이스)까지만 준비한다. **실제 테이블(엔티티) 설계는 이 스킬의 범위가 아니다** — 사용자가 요구사항을 정리한 뒤 별도 스키마 설계 단계(예: `phase-1-schema`)에서 진행하고, 그 결과를 `backend/src/main/resources/db/schema.sql` 형태로 이 프로젝트에 추가한다.

- PostgreSQL이 로컬에 직접 설치되어 있으면: `CREATE DATABASE {project}_db;` 로 빈 DB만 생성
- Docker를 쓰기로 했다면: `docker-compose.yml`에 PostgreSQL 컨테이너 설정만 작성 (테이블 없음)

## 5. 환경 변수 설정

### .env.example (프로젝트 루트, app/, backend/ 각각)
```env
# Frontend (Expo)
EXPO_PUBLIC_API_URL=http://localhost:8080/api

# Backend (Spring Boot)
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_jwt_secret_key
```

## 6. 기본 문서 생성

### README.md (프로젝트 루트)
- 프로젝트 소개
- 기술 스택 요약
- 빠른 시작 (Quick Start)
- 폴더 구조
- 개발 환경 설정

### SETUP.md (개발 환경 설정 가이드)
- 요구사항 확인 (Node.js, Java, PostgreSQL)
- PostgreSQL 로컬 실행/DB 생성
- 프론트엔드 설치 & 실행
- 백엔드 설치 & 실행

### .claude/CLAUDE.md (Claude Code 개발자 가이드)
- 프로젝트 개요, 기술 스택, 브랜드 컬러
- 백엔드 패키지 구조 / 프론트엔드 폴더 구조 (빈 구조 설명)
- 개발 워크플로우
- (데이터베이스 스키마는 아직 없으므로 언급하지 않는다 — 별도 설계 단계 후 채운다)

## 7. 산출물

생성되는 파일/폴더:

```
{project}/
├─ app/                     # React Native 프론트엔드
├─ backend/                 # Spring Boot 백엔드
├─ docs/
│  └─ SETUP.md             # 개발 환경 설정
├─ .env.example
├─ .gitignore
├─ README.md               # 업데이트됨
└─ .claude/CLAUDE.md       # Claude Code 가이드
```

## 8. 검증

생성 후 자동으로 확인:

- Node.js/npm 버전 확인
- Java 버전 확인
- PostgreSQL 연결 테스트 (빈 DB 기준)
- Expo 프로젝트 구조 검증
- Spring Boot Gradle 컴파일 테스트 (`gradlew compileJava`)

## 주의사항

- **이미 폴더가 있으면**: 덮어쓰기 여부 사용자 확인
- **환경변수**: .env.example만 생성, 실제 .env는 사용자가 만들어야 함
- **첫 빌드**: 첫 npm install 및 gradle build는 시간이 걸림 (Gradle wrapper/의존성 다운로드 포함 5~10분)
- **도메인 스키마/엔티티는 절대 임의로 채우지 않는다** — 이전 대화에서 도메인 논의가 있었더라도, 그건 뼈대 생성과 별개로 사용자 확인을 받고 진행한다
