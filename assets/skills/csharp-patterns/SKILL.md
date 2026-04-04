---
# opencode-autopilot
name: csharp-patterns
description: Idiomatic C# patterns including records, .NET DI, Entity Framework, and async best practices
stacks:
  - csharp
requires:
  - coding-standards
---

# C# Patterns

Idiomatic C# patterns for modern (.NET 8+) projects. Covers language features, .NET dependency injection, Entity Framework conventions, async best practices, and common pitfalls. Apply these when writing, reviewing, or refactoring C# code.

## 1. Modern C# Idioms

**DO:** Use modern C# features to write concise, null-safe, and expressive code.

- Use records for immutable data:
  ```csharp
  // Record: immutable, value equality, ToString auto-generated
  public record UserDto(string Name, string Email, DateTimeOffset CreatedAt);

  // With expression for non-destructive mutation
  var updated = original with { Email = "new@example.com" };
  ```
- Use pattern matching with switch expressions:
  ```csharp
  // DO: Switch expression with property patterns
  string GetStatusMessage(Order order) => order switch
  {
      { Status: OrderStatus.Pending, Total: > 1000 } => "Large order pending approval",
      { Status: OrderStatus.Pending } => "Awaiting processing",
      { Status: OrderStatus.Shipped } => $"Shipped on {order.ShippedDate}",
      { Status: OrderStatus.Delivered } => "Delivered",
      _ => "Unknown status"
  };
  ```
- Enable nullable reference types and annotate nullability:
  ```csharp
  // In .csproj: <Nullable>enable</Nullable>

  // Explicit nullability
  public string GetDisplayName(User? user)
  {
      return user?.Name ?? "Anonymous";
  }
  ```
- Use `init`-only properties for immutable object initialization:
  ```csharp
  public class Config
  {
      public required string ConnectionString { get; init; }
      public int MaxRetries { get; init; } = 3;
  }

  var config = new Config { ConnectionString = "Server=..." };
  // config.ConnectionString = "other"; // Compile error
  ```
- Use file-scoped namespaces to reduce nesting:
  ```csharp
  // DO: File-scoped namespace (one less indentation level)
  namespace MyApp.Services;

  public class OrderService { ... }
  ```
- Use raw string literals for multi-line strings:
  ```csharp
  var query = """
      SELECT u.Name, u.Email
      FROM Users u
      WHERE u.IsActive = 1
      ORDER BY u.Name
      """;
  ```

**DON'T:**

- Ignore nullable warnings -- they prevent `NullReferenceException` at runtime
- Use `class` when `record` better represents the data (DTOs, value objects, events)
- Use verbose `if/else if` chains when switch expressions are clearer
- Use `string.Format()` when string interpolation (`$"Hello {name}"`) is available

## 2. .NET Patterns

**DO:** Follow .NET conventions for dependency injection, configuration, and middleware.

- Register services with the built-in DI container:
  ```csharp
  // Program.cs
  builder.Services.AddScoped<IOrderService, OrderService>();
  builder.Services.AddSingleton<ICacheService, RedisCacheService>();
  builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
  ```
- Use `IOptions<T>` for strongly-typed configuration:
  ```csharp
  public record EmailOptions
  {
      public required string Host { get; init; }
      public int Port { get; init; } = 587;
      public bool UseTls { get; init; } = true;
  }

  // Registration
  builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));

  // Injection
  public class EmailSender(IOptions<EmailOptions> options)
  {
      private readonly EmailOptions _options = options.Value;
  }
  ```
- Order middleware carefully -- order matters in the pipeline:
  ```csharp
  app.UseExceptionHandler("/error");  // First: catch everything
  app.UseHttpsRedirection();
  app.UseAuthentication();             // Before authorization
  app.UseAuthorization();              // After authentication
  app.UseRateLimiter();
  app.MapControllers();                // Last: route to handlers
  ```
- Use `IHostedService` for background work:
  ```csharp
  public class CleanupService : BackgroundService
  {
      protected override async Task ExecuteAsync(CancellationToken stoppingToken)
      {
          while (!stoppingToken.IsCancellationRequested)
          {
              await CleanupExpiredSessions();
              await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
          }
      }
  }
  ```
- Use `ILogger<T>` for structured logging:
  ```csharp
  public class OrderService(ILogger<OrderService> logger)
  {
      public void PlaceOrder(Order order)
      {
          logger.LogInformation("Placing order {OrderId} for {CustomerId}",
              order.Id, order.CustomerId);
      }
  }
  ```

**DON'T:**

- Use `new` to create services inside other services -- always inject via constructor
- Register scoped services as singletons -- scoped dependencies in singletons cause captive dependency bugs
- Put business logic in middleware -- middleware is for cross-cutting concerns (auth, logging, CORS)
- Use `IServiceProvider` directly (service locator pattern) -- inject specific interfaces instead

## 3. Entity Framework Conventions

**DO:** Use EF Core idiomatically with code-first migrations and proper lifetime management.

- Use code-first migrations for schema management:
  ```bash
  dotnet ef migrations add AddOrderTable
  dotnet ef database update
  ```
- Register `DbContext` as scoped (default and correct):
  ```csharp
  builder.Services.AddDbContext<AppDbContext>(options =>
      options.UseNpgsql(connectionString));
  ```
- Use navigation properties with explicit loading strategies:
  ```csharp
  // DO: Explicit includes for read paths
  var orders = await context.Orders
      .Include(o => o.Items)
      .Include(o => o.Customer)
      .Where(o => o.Status == OrderStatus.Pending)
      .ToListAsync();
  ```
- Use global query filters for soft delete:
  ```csharp
  // In DbContext.OnModelCreating
  modelBuilder.Entity<Order>()
      .HasQueryFilter(o => !o.IsDeleted);

  // To include deleted: context.Orders.IgnoreQueryFilters()
  ```
- Use `AsNoTracking()` for read-only queries (better performance):
  ```csharp
  var reports = await context.Orders
      .AsNoTracking()
      .Select(o => new OrderSummary(o.Id, o.Total))
      .ToListAsync();
  ```
- Use value converters for custom types:
  ```csharp
  modelBuilder.Entity<Order>()
      .Property(o => o.Currency)
      .HasConversion(
          v => v.Code,                    // To database
          v => Currency.FromCode(v));     // From database
  ```
- Use owned entities for value objects:
  ```csharp
  modelBuilder.Entity<Order>().OwnsOne(o => o.ShippingAddress);
  ```

**DON'T:**

- Return `IQueryable<T>` from repositories -- materialize queries before returning to prevent unintended SQL generation outside the repository
- Use `DbContext` as a singleton -- it is not thread-safe, always use scoped lifetime
- Skip migrations and modify the database manually -- migrations are the source of truth
- Load entire entity graphs when you only need a few fields -- use `Select` projections
- Forget to call `SaveChangesAsync()` -- EF tracks changes but does not persist until you call save

## 4. Async Best Practices

**DO:** Use `async`/`await` consistently and propagate cancellation tokens.

- Go async all the way -- never block on async code:
  ```csharp
  // DO: Async all the way
  public async Task<Order> GetOrderAsync(Guid id, CancellationToken ct)
  {
      var order = await _repository.FindByIdAsync(id, ct);
      return order ?? throw new OrderNotFoundException(id);
  }
  ```
- Use `ConfigureAwait(false)` in library code:
  ```csharp
  // Library code: no need to capture synchronization context
  public async Task<byte[]> DownloadAsync(string url, CancellationToken ct)
  {
      var response = await _client.GetAsync(url, ct).ConfigureAwait(false);
      return await response.Content.ReadAsByteArrayAsync(ct).ConfigureAwait(false);
  }
  ```
- Propagate `CancellationToken` through all async methods:
  ```csharp
  // DO: Accept and pass CancellationToken
  public async Task ProcessAsync(CancellationToken ct = default)
  {
      await StepOneAsync(ct);
      await StepTwoAsync(ct);
  }
  ```
- Use `ValueTask` for hot paths that often complete synchronously:
  ```csharp
  public ValueTask<CacheEntry?> GetCachedAsync(string key)
  {
      if (_memoryCache.TryGetValue(key, out var entry))
          return ValueTask.FromResult<CacheEntry?>(entry);  // No allocation

      return new ValueTask<CacheEntry?>(FetchFromRemoteCacheAsync(key));
  }
  ```
- Use `IAsyncEnumerable<T>` for streaming results:
  ```csharp
  public async IAsyncEnumerable<Order> StreamOrdersAsync(
      [EnumeratorCancellation] CancellationToken ct = default)
  {
      await foreach (var order in context.Orders.AsAsyncEnumerable().WithCancellation(ct))
      {
          yield return order;
      }
  }
  ```

**DON'T:**

- Use `.Result` or `.Wait()` on async methods -- this causes deadlocks in ASP.NET:
  ```csharp
  // DEADLOCK: synchronously blocking on async
  var result = GetOrderAsync(id).Result;  // NEVER do this
  ```
- Use `async void` except for event handlers -- `async void` swallows exceptions
- Forget `CancellationToken` -- without it, cancelled HTTP requests keep executing server-side
- Use `Task.Run()` to wrap synchronous code and pretend it's async -- that just moves work to the thread pool without making it non-blocking

## 5. Common Pitfalls

**Pitfall: Disposal Patterns**
Always dispose resources. Use `using` declarations for deterministic cleanup:
```csharp
// DO: using declaration (disposes at end of scope)
await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync(ct);

// For classes: implement IAsyncDisposable
public class ResourceManager : IAsyncDisposable
{
    public async ValueTask DisposeAsync()
    {
        await ReleaseResourcesAsync();
        GC.SuppressFinalize(this);
    }
}
```

**Pitfall: Captured Loop Variables in Closures**
In older C# (before foreach fix in C# 5), the loop variable was captured by reference. While fixed for `foreach`, be cautious with `for` loops:
```csharp
// CAUTION with for loops
for (int i = 0; i < 10; i++)
{
    var captured = i;  // Capture a copy
    tasks.Add(Task.Run(() => Process(captured)));
}
```

**Pitfall: String Concatenation in Loops**
Strings are immutable in C#. Concatenation in loops creates N intermediate strings. Use `StringBuilder`:
```csharp
// DO
var sb = new StringBuilder();
foreach (var line in lines)
    sb.AppendLine(line);
return sb.ToString();

// DON'T
var result = "";
foreach (var line in lines)
    result += line + "\n";  // N allocations
```

**Pitfall: Deadlocks from Mixing Sync/Async**
Calling `.Result` or `.Wait()` on a `Task` in code that has a synchronization context (ASP.NET, WPF) causes deadlocks. The async continuation needs the context, but `.Result` is blocking it. Solution: go async all the way up.

**Pitfall: Service Locator Anti-Pattern**
Injecting `IServiceProvider` and resolving services manually defeats the purpose of DI. Dependencies become hidden and untestable. Inject specific interfaces instead.
