using Infrastructure.Persistence;
using Domain.Interfaces;
using Infrastructure.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            if (configuration == null) throw new ArgumentNullException(nameof(configuration));

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlServer(
                    configuration.GetConnectionString("DefaultConnection"),
                    b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

            // Bind SMTP settings manually to avoid additional package dependency
            services.Configure<Services.SmtpSettings>(options =>
            {
                var section = configuration.GetSection("SmtpSettings");
                options.Server = section["Server"] ?? string.Empty;
                options.Port = int.TryParse(section["Port"], out var p) ? p : 587;
                options.SenderName = section["SenderName"] ?? string.Empty;
                options.SenderEmail = section["SenderEmail"] ?? string.Empty;
                options.Password = section["Password"] ?? string.Empty;
            });

            // Register repositories
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IRoleRepository, RoleRepository>();
            services.AddScoped<IProjectRepository, ProjectRepository>();
            services.AddScoped<ITicketRepository, TicketRepository>();
            services.AddScoped<ISprintRepository, SprintRepository>();
            services.AddScoped<ICommentaireRepository, CommentaireRepository>();
            services.AddScoped<IConversationRepository, ConversationRepository>();
            services.AddScoped<IMessageRepository, MessageRepository>();

            // Email service
            services.AddScoped<Services.IEmailService, Services.EmailService>();
            // File storage (local)
            services.AddScoped<Services.IFileStorageService, Services.LocalFileStorageService>();

            return services;
        }


    }
}
