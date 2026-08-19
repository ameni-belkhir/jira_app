using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class DeadlineCheckBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DeadlineCheckBackgroundService> _logger;

        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(1);

        public DeadlineCheckBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<DeadlineCheckBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("DeadlineCheckBackgroundService démarré. Vérification toutes les {Interval} minutes.", CheckInterval.TotalMinutes);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var deadlineService = scope.ServiceProvider.GetRequiredService<IDeadlineNotificationService>();
                    await deadlineService.CheckAndSendDeadlineNotificationsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erreur lors de la vérification des échéances.");
                }

                await Task.Delay(CheckInterval, stoppingToken);
            }

            _logger.LogInformation("DeadlineCheckBackgroundService arrêté.");
        }
    }
}
