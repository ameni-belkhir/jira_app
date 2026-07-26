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

            // No SMTP/email service in this build: email-dependent flows removed

            // Register repositories
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IRoleRepository, RoleRepository>();
            services.AddScoped<IProjectRepository, ProjectRepository>();
            services.AddScoped<ITicketRepository, TicketRepository>();
            services.AddScoped<ISprintRepository, SprintRepository>();
            services.AddScoped<ICommentaireRepository, CommentaireRepository>();
            services.AddScoped<IConversationRepository, ConversationRepository>();
            services.AddScoped<IMessageRepository, MessageRepository>();

            // Register AuthService implementation
            services.AddScoped<Application.Interfaces.IAuthService, Services.AuthService>();
            // File storage (local)
            services.AddScoped<Services.IFileStorageService, Services.LocalFileStorageService>();

            return services;
        }


    }
}
