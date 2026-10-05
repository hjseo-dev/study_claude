# Spring 구조 설계 학습 노트

회사 레거시 코드(가입 플로우: 타팀 API → DB insert → AD insert → 메일발송)를 어댑터 패턴으로 리팩토링하면서 정리한 하루치 학습 기록. 코드 예시는 전부 이 가입 플로우 또는 결제(payment) 예시를 재사용함.

> 전체 5원칙의 BAD/GOOD 코드 풀버전(다크 테마)은 [`solid-principles.html`](./solid-principles.html) 참고. 여기는 전체 요약 + 그 외 개념들.

## 목차

- [1. 어댑터 패턴](#1-어댑터-패턴)
- [2. 오케스트레이터 패턴](#2-오케스트레이터-패턴)
- [3. Spring Bean · Component · 컨테이너](#3-spring-bean--component--컨테이너)
- [4. 생성자 주입 vs 필드 주입](#4-생성자-주입-vs-필드-주입)
- [5. AOP](#5-aop)
- [6. Filter vs Interceptor vs AOP](#6-filter-vs-interceptor-vs-aop)
- [7. SOLID 5원칙 요약](#7-solid-5원칙-요약)
- [8. 어댑터 vs 전략 패턴](#8-어댑터-vs-전략-패턴)
- [9. 과설계 판단법](#9-과설계-판단법)
- [10. 인터페이스화 판단 기준](#10-인터페이스화-판단-기준)
- [11. 파라미터가 늘어날 때 — 조건 객체 패턴](#11-파라미터가-늘어날-때--조건-객체-패턴)
- [12. Lombok — 생성자 애너테이션 vs Builder](#12-lombok--생성자-애너테이션-vs-builder)
- [13. Bean(싱글톤) vs 일반 객체(new)](#13-bean싱글톤-vs-일반-객체new)

---

## 1. 어댑터 패턴

**한 줄 정의**: 서로 다른 인터페이스(메서드 이름·파라미터·리턴타입이 제각각인 것들)를 같은 모양으로 통일시켜주는 "변환기".

```java
// 서로 다른 모양
public class CardPaymentApi { public void charge(long amount) {...} }
public class KakaoPayClient { public void pay(String userId, long amount) {...} }
public class TossPayClient  { public PaymentResponse requestPayment(PaymentInfo info) {...} }
```

```java
// 통일된 인터페이스로 감싸기
public interface PaymentAdapter {
    void pay(String userId, long amount);
}

public class TossPayAdapter implements PaymentAdapter {
    private final TossPayClient tossPayClient;
    public void pay(String userId, long amount) {
        tossPayClient.requestPayment(new PaymentInfo(userId, amount));  // 원래 모양 → 통일된 모양
    }
}
```

호출하는 쪽(오케스트레이터)은 `pay(userId, amount)` 한 가지 모양만 알면 됨 — 안에서 `charge`를 부르는지 `requestPayment`를 부르는지 몰라도 됨.

---

## 2. 오케스트레이터 패턴

여러 어댑터를 순서대로 호출만 하는 "지휘자" 역할의 클래스.

```java
@Service
public class SignupOrchestrator {
    private final ExternalSignupAdapter externalSignupAdapter;
    private final UserDbAdapter userDbAdapter;
    private final AdDbAdapter adDbAdapter;
    private final MailAdapter mailAdapter;

    public SignupOrchestrator(ExternalSignupAdapter a, UserDbAdapter b, AdDbAdapter c, MailAdapter d) {
        this.externalSignupAdapter = a; this.userDbAdapter = b; this.adDbAdapter = c; this.mailAdapter = d;
    }

    public SignupResult signup(SignupRequest request) {
        StepResult step1 = externalSignupAdapter.callPartnerApi(request);
        if (!step1.isSuccess()) return SignupResult.failedAt(step1);
        StepResult step2 = userDbAdapter.insertUser(request);
        if (!step2.isSuccess()) return SignupResult.failedAt(step2);
        // ... 3, 4단계도 동일 패턴
        return SignupResult.allSuccess();
    }
}
```

오케스트레이터만 보면 "가입 처리가 어떤 순서로 진행되는지, 어디서 실패했는지"가 한눈에 보임. 각 단계의 실제 구현 디테일은 어댑터 안에 숨겨짐.

---

## 3. Spring Bean · Component · 컨테이너

### Bean이란

Spring이 `new`를 대신 해줘서 자기 창고(컨테이너)에 넣어두고 관리하는 객체.

### 등록 방법 2가지

| | 붙이는 위치 | 용도 |
|---|---|---|
| `@Component` (`@Service`/`@Repository`/`@Controller`) | 내가 만든 클래스 | "자동으로 Bean 등록해줘" (자동 스캔) |
| `@Bean` | `@Configuration` 클래스 안의 **메서드** | "내가 직접 만드는 법 알려줄게, 이 객체를 등록해줘" (외부 라이브러리 클래스처럼 `@Component`를 못 붙이는 경우) |

```java
@Configuration
public class MailConfig {
    @Bean
    public JavaMailSender javaMailSender() {   // 외부 라이브러리 클래스라 @Component 불가
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost("smtp.gmail.com");
        return mailSender;
    }
}
```

`@Bean`은 **메서드**에 붙는 애너테이션이고, `@Configuration`은 그 메서드를 담은 **클래스**에 붙는 애너테이션. 실제로 다른 곳에서 주입받는 건 `MailConfig`가 아니라 메서드가 리턴한 `JavaMailSender`.

### 컨테이너가 하는 일

```
1. 앱 시작
2. 컨테이너(ApplicationContext) 생성
3. @Component 등 붙은 클래스를 스캔
4. 찾은 클래스들을 new 해서 Bean으로 만듦
5. Bean들끼리 필요한 의존성을 자동으로 연결(DI)
6. 이후 @Autowired/생성자는 "컨테이너에서 꺼내줘" 요청일 뿐
```

Bean 컨테이너가 없으면, 클래스가 늘어날수록 "누가 뭘 필요로 하는지" 연결 코드를 전부 손으로 관리해야 함 — Bean/컨테이너는 이 조립을 자동화해주는 것.

---

## 4. 생성자 주입 vs 필드 주입

```java
// 지양 — 필드 주입
@Service
public class OrderOrchestrator {
    @Autowired
    private PaymentAdapter paymentAdapter;
}
```

```java
// 권장 — 생성자 주입
@Service
public class OrderOrchestrator {
    private final PaymentAdapter paymentAdapter;   // final 가능

    public OrderOrchestrator(PaymentAdapter paymentAdapter) {
        this.paymentAdapter = paymentAdapter;
    }
}
```

| | 필드 주입 | 생성자 주입 |
|---|---|---|
| 테스트 (`new`로 순수 Java 테스트) | ❌ Spring 컨테이너 없이 불가 | ✅ `new Foo(mock)`으로 바로 가능 |
| `final` | ❌ 불가 | ✅ 불변 보장 |
| 순환참조 발견 시점 | 런타임에 숨겨짐 | 앱 **시작 시점**에 바로 터짐 (`BeanCurrentlyInCreationException`) |
| 의존성 개수 체감 | 계속 추가해도 안 불편함 | 생성자가 길어지면 "책임 너무 많나?" 신호가 바로 보임 |

생성자가 하나뿐이면 `@Autowired` 자체를 생략해도 Spring이 자동 인식함(4.3+).

---

## 5. AOP

**횡단 관심사**(로깅, 트랜잭션, 예외처리 등 여러 클래스에 공통으로 필요한 로직)를 핵심 로직에서 분리하는 기법.

```java
@Aspect
@Component
public class AdapterLoggingAspect {

    @Around("execution(* com.company.signup.adapter.*.*(..))")
    public Object logAround(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        try {
            Object result = joinPoint.proceed();   // 실제 메서드 실행
            log.info("{} 성공", methodName);
            return result;
        } catch (Exception e) {
            log.error("{} 실패: {}", methodName, e.getMessage());
            throw e;
        }
    }
}
```

### 동작 원리 — 프록시

Spring이 진짜 객체 대신 **겉모습만 똑같은 프록시**를 Bean으로 등록해두고, 호출을 가로채서 Aspect 로직을 실행한 뒤 진짜 객체로 넘김.

```
Controller → [프록시 PartnerApiAdapter] → (Aspect 로직) → 진짜 PartnerApiAdapter
```

`@Transactional`도 같은 원리 — 메서드 호출 전후로 트랜잭션 시작/커밋/롤백을 프록시가 자동으로 끼워넣는 것.

### 함정 — self-invocation (자기 자신 호출)

```java
@Service
public class SignupOrchestrator {
    @Transactional
    public void step1() {
        step2();   // 같은 클래스 안에서 직접 호출 → 프록시를 안 거침!
    }
    @Transactional
    public void step2() { ... }   // step1()에서 부르면 이 @Transactional은 적용 안 됨
}
```

프록시 기반이라 **자기 자신 메서드 호출은 가로채지 못함** — AOP 전체(트랜잭션/로깅/캐싱)에서 공통으로 발생하는 함정. 해결은 보통 다른 Bean으로 분리.

---

## 6. Filter vs Interceptor vs AOP

```
요청 → Filter(서블릿 컨테이너) → DispatcherServlet
  → Interceptor.preHandle(Spring, 어떤 컨트롤러인지 앎)
    → Controller 호출 (그 안에서 Service/Adapter 호출 시 AOP 끼어듦)
  → Interceptor.postHandle
→ Interceptor.afterCompletion → Filter
```

| | Filter | Interceptor | AOP |
|---|---|---|---|
| 관리 주체 | 서블릿 컨테이너 | Spring | Spring |
| 적용 범위 | 모든 HTTP 요청 | Controller에 매핑된 요청 | **임의의 Bean 메서드** (HTTP 무관) |
| 대표 용도 | 인코딩, CORS, 전역 로깅 | 인증/인가, 공통 전처리 | 트랜잭션, 메서드 단위 로깅, 캐싱 |

가장 중요한 차이: Filter/Interceptor는 **HTTP 요청에만** 쓸 수 있고, AOP는 HTTP와 무관한 일반 메서드(배치 작업, 내부 서비스 로직)에도 적용 가능.

---

## 7. SOLID 5원칙 요약

| 원칙 | 핵심 | 오늘 코드와의 연결 |
|---|---|---|
| **S**RP (단일책임) | 클래스는 "하나의 변경 이유"만 가져야 함 | `register()` 메서드 "안"의 4가지 책임(API/DB/AD/메일)을 분리 — "컨트롤러에 엔드포인트 여러 개 = SRP 위반"은 오해, 메서드 내부 책임 혼재가 진짜 문제 |
| **O**CP (개방폐쇄) | 확장엔 열려있고 기존 코드 수정엔 닫혀있어야 함 | 결제수단 추가 = 새 어댑터 파일만 추가, 기존 코드 無변경 |
| **L**SP (리스코프 치환) | 구현체는 서로 바꿔 끼워도 안전해야 함 | 모든 `PaymentAdapter` 구현체가 같은 방식으로 성공/실패를 처리해야 함 |
| **I**SP (인터페이스 분리) | 안 쓰는 메서드까지 강제로 구현시키지 말 것 | `PaymentAdapter`에 `refund`/`cancelSubscription`을 다 넣지 말고 역할별로 쪼갬 |
| **D**IP (의존 역전) | 구체 클래스 대신 인터페이스에 의존 | `OrderOrchestrator`는 `TossPayClient`가 아니라 `PaymentAdapter`를 앎 — Spring DI가 이걸 가능케 함 |

상세 BAD/GOOD 코드는 [`solid-principles.html`](./solid-principles.html) 참고.

---

## 8. 어댑터 vs 전략 패턴

구조(인터페이스 모양)는 똑같이 생겼음. 차이는 **"왜 인터페이스로 뽑았는가"**.

| | 어댑터 | 전략 |
|---|---|---|
| 목적 | 이미 존재하는 **호환 안 되는 API**를 맞춤 | 처음부터 **여러 알고리즘/정책 중 선택**하도록 설계 |
| 계기 | "외부 라이브러리가 내가 원하는 모양이 아니네" (수동적) | "이 로직은 상황마다 다르게 동작해야겠다" (능동적) |

```java
// 순수 전략 패턴 예시 — 호환성 문제가 아니라 "정책 선택" 문제
public interface DiscountStrategy { long apply(long originalPrice); }
public class PercentageDiscount implements DiscountStrategy { ... }
public class FixedAmountDiscount implements DiscountStrategy { ... }
```

실무에서는 경계가 흐려지는 경우가 많아서, "이게 어댑터냐 전략이냐" 논쟁보다 **왜 인터페이스로 뽑았는지 의도를 기억하는 게** 더 중요함.

---

## 9. 과설계 판단법

### Rule of Three

```
1번째(카드만) → 그냥 구현, 인터페이스 안 뽑음
2번째(카드+카카오) → 아직 참음
3번째(카드+카카오+토스) → 이제 어댑터로 뽑음
```

### 판단 기준 4가지

1. **구현체가 실제로 2개 이상** 있거나 곧 생기는 게 확정됐는가?
2. 이 추상화가 없으면 **정말 못 바꾸는가**, 아니면 if문 하나 추가하면 끝인가?
3. 6개월 뒤에 보는 사람이 "왜 이렇게 복잡하게 짰지?"라고 생각할 여지가 있는가?
4. **나중에 추가하는 비용이 얼마나 드는가?** (IDE "Extract Interface" 리팩토링 한 번이면 끝나면 → 미리 안 해도 됨)

### "늘어날 수도 있다"는 느낌 대신 증거로 판단

| 느낌(추측) | 증거(사실) |
|---|---|
| "나중에 늘어날 수도 있잖아?" | git log로 **과거에 실제로 바뀐 이력**이 있는가? |
| "그럴 것 같은데" | **확정된 계획**(PM/기획 확인)이 있는가? |
| "혹시 모르니까 미리" | 나중에 되돌리는 비용이 **싼가, 비싼가**? (대부분 쌈 → 미리 안 해도 됨) |

인터페이스 추출은 대부분 "되돌리기 쉬운 결정(two-way door)"이라, 증거 없이는 기본값을 "안 뽑는다"로 둬도 됨.

### IntelliJ "Extract Interface" 리팩토링

클래스명에 커서 → `Ctrl+Alt+Shift+T` → Extract Interface 선택 → 메서드 체크 → OK. **판단은 개발자 몫, 도구는 타이핑만 대신해줌.**

---

## 10. 인터페이스화 판단 기준

❌ "기능별로 하나씩" — 틀린 기준
✅ **"이 기능을 수행하는 방법이 여러 개로 갈라질 가능성이 있는가"** — 맞는 기준

| 단계 | 갈라질 가능성? | 인터페이스화? |
|---|---|---|
| 타팀 API 호출 | 제휴사 추가될 수 있음 | O |
| DB insert | 우리 DB는 하나뿐 | X — 그냥 클래스 직접 사용 |
| AD insert | AD 시스템도 하나뿐 | X |
| 메일 발송 | 알림 채널(SMS 등) 늘어날 수도 | O 또는 보류 |

오케스트레이터 안에 "인터페이스인 애"와 "그냥 클래스인 애"가 섞여 있는 게 정상.

---

## 11. 파라미터가 늘어날 때 — 조건 객체 패턴

```java
// 나쁨 — 조건 늘 때마다 메서드 추가 (인터페이스 불안정)
public interface AdAdapter {
    List<Ad> select(String userId);
    List<Ad> select(String userId, String status);
    List<Ad> select(String userId, String status, LocalDate date);
}
```

```java
// 좋음 — 조건을 객체로 묶음, 메서드 시그니처는 항상 고정
public class AdSearchCondition {
    private final String userId;
    private final String status;   // null이면 조건 생략
    private final LocalDate date;
}

public interface AdAdapter {
    List<Ad> select(AdSearchCondition condition);
}
```

조건이 늘어나도 메서드 시그니처는 안 바뀌고, `AdSearchCondition`에 필드만 추가하면 됨.

---

## 12. Lombok — 생성자 애너테이션 vs Builder

| 애너테이션 | 생성물 | 사용법 |
|---|---|---|
| `@RequiredArgsConstructor` | `final` 필드로 생성자 생성 | `new Foo(a, b)` — DI용 Bean에 추천 |
| `@AllArgsConstructor` | 전체 필드로 생성자 생성 | `new Foo(a, b, c)` |
| `@Builder` | **생성자가 아니라 빌더 클래스** | `Foo.builder().a(1).b(2).build()` — 필드 많거나 일부 선택적일 때 추천 |

```java
@RequiredArgsConstructor   // 손으로 생성자 안 써도 Lombok이 자동 생성
@Service
public class UserService {
    private final PartnerApiClient partnerApiClient;
    private final AdAdapter adAdapter;
    // @Autowired도 필요 없음 — 생성자가 하나뿐이라 Spring이 자동 인식
}
```

**필드 `@Autowired`는 Lombok을 써도 여전히 안 좋은 패턴.** `@RequiredArgsConstructor` + `final` 조합이 "편한데도 좋은 패턴".

---

## 13. Bean(싱글톤) vs 일반 객체(new)

기준: **"이 객체 안의 값이 호출할 때마다 달라지는가?"**

| | 판단 | 결과 |
|---|---|---|
| 로직/동작만 있고 내부 상태가 없음 | `Service`, `Adapter`, `Repository`, `Client` | **Bean** (`@Component` + DI) |
| 호출마다 내용이 달라지는 데이터 | `Request`, `Response`, `Dto`, `Condition`, `Entity` | **매번 `new`** (Lombok `@Builder` 등은 OK, `@Component`는 금지) |

```java
// 위험 — 데이터 객체를 Bean(싱글톤)으로 만들면
@Component
public class AdSearchCondition {
    private String userId;   // 동시 요청 시 서로 값을 덮어씀 (race condition)
}
```

```java
// 안전 — 호출할 때마다 새로 생성해서 파라미터로 전달
AdSearchCondition condition = AdSearchCondition.builder().userId(userId).build();
adAdapter.select(condition);
```

Spring Bean은 기본이 **싱글톤**이라, 상태(데이터)를 가진 객체를 Bean으로 만들면 여러 요청이 하나의 인스턴스를 공유하게 돼 동시성 버그로 이어짐.

---

*작성일: 2026-10-06*
