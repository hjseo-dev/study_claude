# 언어별 테스트 프레임워크 / Mock 관례

test-case-creator가 감지된 언어에 맞춰 테스트 코드를 생성할 때 참고하는
기본 관례다. **프로젝트에 이미 테스트 코드나 특정 프레임워크가 쓰이고
있다면 이 문서보다 그 실제 관례를 우선한다.**

## Java

- 프레임워크: **JUnit 5** (`@Test`, `@BeforeEach`, `@ParameterizedTest`)
- Mock: **Mockito** (`@Mock`, `@InjectMocks`, `@ExtendWith(MockitoExtension.class)`)
- 파일 위치/네이밍: `src/test/java/<패키지 미러>/<클래스명>Test.java`
- 실행: Maven `mvn test -Dtest=<클래스명>` / Gradle `./gradlew test --tests <클래스명>`

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private PaymentClient paymentClient;

    @InjectMocks
    private OrderService orderService;

    @Test
    void 정상_주문_생성시_주문ID를_반환한다() {
        when(paymentClient.charge(any())).thenReturn(new PaymentResult(true));

        OrderResult result = orderService.createOrder(validRequest());

        assertThat(result.getOrderId()).isNotNull();
    }

    @Test
    void 결제_실패시_예외를_전파하지_않고_실패_응답을_반환한다() {
        when(paymentClient.charge(any())).thenThrow(new TimeoutException());

        OrderResult result = orderService.createOrder(validRequest());

        assertThat(result.isSuccess()).isFalse();
    }
}
```

## Kotlin

- 프레임워크: 프로젝트에 **JUnit 5** 또는 **Kotest**가 이미 있으면 그것을
  따른다. 없으면 JUnit 5 + `kotlin.test` 기본값.
- Mock: **MockK** (`mockk<T>()`, `every { ... } returns ...`) — Mockito보다
  Kotlin 코드베이스에서 더 흔하다.
- 파일 위치: `src/test/kotlin/<패키지 미러>/<클래스명>Test.kt`

## JavaScript / TypeScript

- 프레임워크: `package.json`에서 감지 — **Jest** 또는 **Vitest**
  (`jest.config.*`/`vitest.config.*` 유무로 판별)
- Mock: Jest `jest.mock(...)`/`jest.fn()`, Vitest `vi.mock(...)`/`vi.fn()`
- 파일 위치/네이밍: 기존 프로젝트 관례 우선 —
  `__tests__/<이름>.test.ts` 또는 소스 파일 옆 `<이름>.test.ts`
- 실행: `npx jest <파일>` / `npx vitest run <파일>`

```ts
jest.mock('../clients/paymentClient');

describe('OrderService', () => {
  it('정상 입력으로 주문을 생성하면 orderId를 반환한다', async () => {
    (paymentClient.charge as jest.Mock).mockResolvedValue({ success: true });

    const result = await orderService.createOrder(validRequest);

    expect(result.orderId).toBeDefined();
  });

  it('외부 결제 API 타임아웃 시 예외가 전파되지 않는다', async () => {
    (paymentClient.charge as jest.Mock).mockRejectedValue(new Error('timeout'));

    const result = await orderService.createOrder(validRequest);

    expect(result.success).toBe(false);
  });
});
```

## Python

- 프레임워크: **pytest** (기본 우선), `unittest`가 이미 쓰이고 있으면 그것을 따른다
- Mock: `unittest.mock` (`Mock`, `patch`) 또는 이미 있으면 `pytest-mock`(`mocker`)
- 파일 위치/네이밍: `tests/test_<모듈명>.py`, 함수명은 `test_...`

```python
def test_정상_입력으로_주문_생성시_주문id_반환(mocker):
    mocker.patch("app.clients.payment_client.charge", return_value=PaymentResult(True))

    result = order_service.create_order(valid_request())

    assert result.order_id is not None


def test_결제_타임아웃시_예외가_전파되지_않는다(mocker):
    mocker.patch("app.clients.payment_client.charge", side_effect=TimeoutError())

    result = order_service.create_order(valid_request())

    assert result.success is False
```

## Go

- 프레임워크: 표준 `testing` 패키지, 테이블 주도 테스트(table-driven test) 스타일
- Mock: 인터페이스 기반 수동 스텁 또는 `testify/mock`(이미 쓰이고 있으면)
- 파일 위치/네이밍: 소스 파일과 같은 패키지의 `<이름>_test.go`
- 실행: `go test ./<패키지>/... -run <TestName>`

## C# / .NET

- 프레임워크: **xUnit**(`[Fact]`, `[Theory]`) — NUnit이 이미 쓰이고 있으면 그것을 따른다
- Mock: **Moq** (`Mock<T>()`, `.Setup(...).Returns(...)`)
- 파일 위치/네이밍: `<프로젝트>.Tests/<클래스명>Tests.cs`

## PHP

- 프레임워크: **PHPUnit**
- Mock: PHPUnit 내장 Mock (`createMock(...)`) 또는 프로젝트에 있으면 **Mockery**
- 파일 위치/네이밍: `tests/<클래스명>Test.php`

## Ruby

- 프레임워크: **RSpec**
- Mock: `rspec-mocks` (`instance_double`, `allow(...).to receive(...)`)
- 파일 위치/네이밍: `spec/<이름>_spec.rb`

## Mock으로 대체 불가능한 경우 (공통)

다음과 같은 경우는 Mock으로 대체하지 말고 테스트 코드 상단 주석과 결과 요약에
"⚠️ 로컬 전용 — Mock 불가, 실제 환경 필요"라고 명시한다:

- 실제 로컬 DB/파일시스템 상태에 의존하는 통합 테스트
- 사설 네트워크(VPN, 로컬 전용 서비스)에만 존재하는 의존성
- 로컬에만 설정된 환경변수/자격증명이 있어야 재현되는 동작
- 실제 타이밍/동시성 환경(레이스 컨디션)에서만 재현 가능한 케이스
