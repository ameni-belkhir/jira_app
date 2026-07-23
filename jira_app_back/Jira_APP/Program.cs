using Infrastructure;
using Presentation;
using Application;
using Serilog;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Register controllers from the Presentation (API) assembly so MVC discovers them
// Register controllers from the Presentation (API) assembly so MVC discovers them
builder.Services.AddControllers()
    .AddApplicationPart(typeof(Presentation.DependencyInjection).Assembly)
    .AddJsonOptions(x => x.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
// Ensure Swagger includes operations from controllers in referenced assemblies
builder.Services.AddSwaggerGen(options =>
{
    options.DocInclusionPredicate((docName, apiDesc) => true);
    // Add JWT Bearer definition for Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' [space] and then your valid token in the text input below."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new string[] { }
        }
    });
    // Map IFormFile to a binary string schema so Swagger can describe file uploads
    options.MapType<Microsoft.AspNetCore.Http.IFormFile>(() => new OpenApiSchema
    {
        Type = "string",
        Format = "binary"
    });
    // Support file uploads (IFormFile) in Swagger UI
    options.OperationFilter<Jira_APP.Swagger.SwaggerFileOperationFilter>();
});
builder.Services
    .AddInfrastructure(builder.Configuration)
    .AddPresentation()
    .AddApplication();

// CORS policy for Angular client
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register AuthService
builder.Services.AddScoped<Jira_APP.Services.IAuthService, Jira_APP.Services.AuthService>();

// JWT Authentication
var jwtSecret = builder.Configuration["Jwt:SecretKey"];
if (!string.IsNullOrEmpty(jwtSecret))
{
    var key = Encoding.UTF8.GetBytes(jwtSecret);
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    }).AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };
    });
}
builder.Host.UseSerilog((context, configuration) =>
{
    configuration.ReadFrom.Configuration(context.Configuration);
});
var app = builder.Build();

// Configure the HTTP request pipeline.
// Expose Swagger UI at application root so it s'ouvre au démarrage.
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    // Ensure the Swagger endpoint name matches expected value and
    // make the UI available at /swagger so launchSettings.json "launchUrl": "swagger" works.
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Jira API v1");
    c.RoutePrefix = "swagger";
});

app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

// Serve static files (wwwroot) for profile images and other assets
app.UseStaticFiles();

// Enable CORS for Angular client before authentication/authorization
app.UseCors("AllowAngularApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
