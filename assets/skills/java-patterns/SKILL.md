---
name: java-patterns
description: Idiomatic Java patterns including records, Spring Boot conventions, JPA/Hibernate, and common pitfalls
stacks:
  - java
requires:
  - coding-standards
---

# Java Patterns

Idiomatic Java patterns for modern (17+) projects. Covers language features, Spring Boot conventions, JPA/Hibernate best practices, testing idioms, and common pitfalls. Apply these when writing, reviewing, or refactoring Java code.

## 1. Modern Java Idioms

**DO:** Use modern Java features to write concise, safe, and expressive code.

- Use records for immutable data carriers:
  ```java
  // Record: immutable, equals/hashCode/toString auto-generated
  public record UserDto(String name, String email, Instant createdAt) {}

  // Use in APIs, DTOs, value objects -- not JPA entities
  var user = new UserDto("Alice", "alice@example.com", Instant.now());
  ```
- Use sealed classes for restricted type hierarchies:
  ```java
  public sealed interface Shape permits Circle, Rectangle, Triangle {
      double area();
  }

  public record Circle(double radius) implements Shape {
      public double area() { return Math.PI * radius * radius; }
  }
  ```
- Use Optional for nullable returns -- never for fields or parameters:
  ```java
  // DO: Chain operations safely
  Optional<User> user = repository.findById(id);
  String name = user.map(User::name).orElse("Anonymous");

  // DO: Handle absence explicitly
  return repository.findById(id)
      .orElseThrow(() -> new UserNotFoundException(id));
  ```
- Use pattern matching with `instanceof`:
  ```java
  // DO: Pattern matching eliminates manual cast
  if (shape instanceof Circle c) {
      return Math.PI * c.radius() * c.radius();
  }
  ```
- Use text blocks for multi-line strings:
  ```java
  String query = """
      SELECT u.name, u.email
      FROM users u
      WHERE u.active = true
      ORDER BY u.name
      """;
  ```

**DON'T:**

- Use `Optional.get()` without checking `isPresent()` -- use `orElse()`, `orElseThrow()`, or `map()`
- Use Optional as a method parameter or field type -- it's for return values only
- Return `null` from public methods when Optional is appropriate
- Use raw types: `List` instead of `List<String>`
- Use `instanceof` followed by a manual cast when pattern matching is available

## 2. Spring Boot Patterns

**DO:** Follow Spring Boot conventions for maintainable, testable applications.

- Use constructor-based dependency injection -- never field injection:
  ```java
  // DO: Constructor injection (immutable, testable)
  @Service
  public class OrderService {
      private final OrderRepository orderRepo;
      private final PaymentGateway paymentGateway;

      public OrderService(OrderRepository orderRepo, PaymentGateway paymentGateway) {
          this.orderRepo = orderRepo;
          this.paymentGateway = paymentGateway;
      }
  }
  ```
- Layer architecture: Controller -> Service -> Repository:
  ```java
  @RestController        // Thin: HTTP concerns only
  @Service               // Business logic and orchestration
  @Repository            // Data access only
  ```
- Place `@Transactional` on the service layer, not on repositories:
  ```java
  @Service
  public class TransferService {
      @Transactional
      public void transfer(AccountId from, AccountId to, Money amount) {
          accountRepo.debit(from, amount);
          accountRepo.credit(to, amount);
      }
  }
  ```
- Use `@ConfigurationProperties` for type-safe configuration:
  ```java
  @ConfigurationProperties(prefix = "app.email")
  public record EmailConfig(String host, int port, boolean useTls) {}
  ```
- Handle exceptions with `@ControllerAdvice`:
  ```java
  @ControllerAdvice
  public class GlobalExceptionHandler {
      @ExceptionHandler(UserNotFoundException.class)
      public ResponseEntity<ErrorResponse> handleNotFound(UserNotFoundException ex) {
          return ResponseEntity.status(404)
              .body(new ErrorResponse(ex.getMessage()));
      }
  }
  ```

**DON'T:**

- Use `@Autowired` on fields -- constructor injection is immutable and explicit
- Put business logic in controllers -- controllers parse HTTP, services execute logic
- Use `@Transactional` on repository methods -- Spring Data already wraps queries
- Catch exceptions in controllers individually -- use `@ControllerAdvice` for centralized handling
- Use Spring profiles for feature flags -- profiles are for environments (dev, staging, prod)

## 3. JPA/Hibernate Conventions

**DO:** Design entities carefully and be explicit about fetching behavior.

- Mark IDs as immutable and use `@Version` for optimistic locking:
  ```java
  @Entity
  public class Order {
      @Id @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      @Version
      private Long version;  // Optimistic locking -- prevents lost updates
  }
  ```
- Default to lazy fetching, use explicit join fetch for read paths:
  ```java
  // DO: Lazy by default
  @ManyToOne(fetch = FetchType.LAZY)
  private Customer customer;

  // DO: Explicit fetch when needed
  @EntityGraph(attributePaths = {"customer", "items"})
  Optional<Order> findWithDetailsById(UUID id);
  ```
- Prevent N+1 queries with `@EntityGraph` or `JOIN FETCH`:
  ```java
  // Repository method with join fetch
  @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.status = :status")
  List<Order> findByStatusWithItems(@Param("status") OrderStatus status);
  ```
- Use DTOs for API responses, never expose entities directly:
  ```java
  // DO: Project to DTO
  public record OrderSummary(UUID id, String customerName, BigDecimal total) {
      public static OrderSummary from(Order order) {
          return new OrderSummary(order.getId(), order.getCustomer().getName(), order.getTotal());
      }
  }
  ```

**DON'T:**

- Use `FetchType.EAGER` on `@ManyToOne` or `@OneToMany` -- it causes unexpected extra queries
- Return JPA entities from REST endpoints -- entities carry lazy proxies and hibernate state
- Use `CascadeType.ALL` without thinking -- cascade delete can wipe related data unexpectedly
- Call `entity.getCollection().size()` to check emptiness -- use a count query instead
- Mutate entity state outside a `@Transactional` context -- changes won't persist or may throw

## 4. Testing

**DO:** Write focused tests that verify behavior, using the right test slice.

- Use JUnit 5 `@Nested` for grouping related test scenarios:
  ```java
  class OrderServiceTest {
      @Nested
      class WhenOrderIsValid {
          @Test
          void shouldCalculateTotal() { ... }

          @Test
          void shouldApplyDiscount() { ... }
      }

      @Nested
      class WhenOrderIsEmpty {
          @Test
          void shouldThrowValidationException() { ... }
      }
  }
  ```
- Use Mockito for isolating dependencies:
  ```java
  @ExtendWith(MockitoExtension.class)
  class OrderServiceTest {
      @Mock OrderRepository orderRepo;
      @Mock PaymentGateway paymentGateway;
      @InjectMocks OrderService service;

      @Test
      void shouldProcessPayment() {
          when(paymentGateway.charge(any())).thenReturn(PaymentResult.success());
          service.placeOrder(order);
          verify(paymentGateway).charge(any());
      }
  }
  ```
- Use test slices instead of `@SpringBootTest` for faster tests:
  ```java
  @WebMvcTest(OrderController.class)    // Controller tests only
  @DataJpaTest                          // Repository tests only
  @JsonTest                             // JSON serialization tests only
  ```
- Use AssertJ for fluent, readable assertions:
  ```java
  assertThat(orders)
      .hasSize(3)
      .extracting(Order::status)
      .containsExactly(PENDING, SHIPPED, DELIVERED);
  ```

**DON'T:**

- Use `@SpringBootTest` for every test -- it loads the full application context (slow)
- Mock everything -- test real behavior where possible, mock only external boundaries
- Write tests that depend on database state from other tests -- each test should set up its own state
- Use `assertEquals(expected, actual)` when AssertJ provides a more readable alternative

## 5. Common Pitfalls

**Pitfall: Mutable Date/Time**
Use `java.time.*` exclusively. Never use `java.util.Date` or `java.util.Calendar` -- they are mutable and error-prone. Use `Instant` for timestamps, `LocalDate` for dates without time, `ZonedDateTime` for timezone-aware dates.

**Pitfall: Checked Exceptions Overuse**
Reserve checked exceptions for truly recoverable conditions that the caller MUST handle (e.g., `IOException` when writing to disk). Use unchecked exceptions (`RuntimeException` subclasses) for programming errors and business rule violations.

**Pitfall: Null Returns**
Return `Optional<T>` from methods that may not produce a value. For collections, return empty collections instead of `null`. Use `@Nullable` annotations from `jakarta.annotation` when Optional is not appropriate (e.g., record fields).

**Pitfall: `==` vs `.equals()` for Objects**
`==` compares references, `.equals()` compares values. Always use `.equals()` for `String`, `Integer`, `BigDecimal`, and all objects. Exception: enum values can use `==` because enums are singletons.

**Pitfall: Raw Types**
Always specify generic type parameters. `List` instead of `List<String>` bypasses compile-time type safety and can cause `ClassCastException` at runtime.

**Pitfall: Synchronized Blocks in Spring Beans**
Spring beans are singletons by default. Using `synchronized` on a bean method serializes all requests through that method. Use `@Async`, message queues, or database-level locking instead of in-process synchronization for concurrent request handling.
