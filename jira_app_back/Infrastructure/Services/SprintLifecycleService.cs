using System;
using System.Linq;
using System.Threading.Tasks;
using Application.Interfaces;
using Domain.Entity;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class SprintLifecycleService : ISprintLifecycleService
    {
        private readonly ApplicationDbContext _context;
        private readonly INotificationService _notificationService;
        private readonly ILogger<SprintLifecycleService> _logger;

        public SprintLifecycleService(
            ApplicationDbContext context,
            INotificationService notificationService,
            ILogger<SprintLifecycleService> logger)
        {
            _context = context;
            _notificationService = notificationService;
            _logger = logger;
        }

        public async Task CheckSprintLifecycleAsync()
        {
            await AutoStartSprintsAsync();
            await NotifySprintEndingSoonAsync();
        }

        /// <summary>
        /// Passe en "Active" tous les sprints Planned dont la StartDate est atteinte.
        /// </summary>
        private async Task AutoStartSprintsAsync()
        {
            var utcNow = DateTime.UtcNow;

            var sprintsToStart = await _context.Sprints
                .AsNoTracking()
                .Where(s => s.Status == SprintStatus.Planned
                    && s.StartDate.HasValue
                    && s.StartDate.Value <= utcNow)
                .ToListAsync();

            foreach (var sprint in sprintsToStart)
            {
                try
                {
                    // Recharger en tracked pour modification
                    var tracked = await _context.Sprints.FindAsync(sprint.Id);
                    if (tracked == null || tracked.Status != SprintStatus.Planned) continue;

                    tracked.Status = SprintStatus.Active;
                    await _context.SaveChangesAsync();

                    _logger.LogInformation(
                        "Sprint {SprintId} ('{SprintName}') démar automatiquement (StartDate={StartDate}).",
                        tracked.Id, tracked.Name, tracked.StartDate);

                    await NotifySprintStartedAsync(tracked);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Erreur lors du démarrage automatique du sprint {SprintId}.", sprint.Id);
                }
            }
        }

        /// <summary>
        /// Notifie les membres du projet qu'un sprint actif se termine dans <= 24h.
        /// Déduplication : au maximum 1 notif par utilisateur par sprint par jour.
        /// </summary>
        private async Task NotifySprintEndingSoonAsync()
        {
            var utcNow = DateTime.UtcNow;
            var horizon = utcNow.AddHours(24);

            var endingSprints = await _context.Sprints
                .AsNoTracking()
                .Where(s => s.Status == SprintStatus.Active
                    && s.EndDate.HasValue
                    && s.EndDate.Value <= horizon
                    && s.EndDate.Value > utcNow)
                .ToListAsync();

            foreach (var sprint in endingSprints)
            {
                try
                {
                    await SendEndingSoonNotificationsAsync(sprint, utcNow);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Erreur lors de l'envoi des notifications de fin pour le sprint {SprintId}.", sprint.Id);
                }
            }
        }

        private async Task NotifySprintStartedAsync(Sprint sprint)
        {
            if (sprint.ProjectId == 0) return;

            var recipientUserIds = await GetProjectRecipientIdsAsync(sprint.ProjectId);
            var targetUrl = $"/projects/{sprint.ProjectId}/backlog";

            var title = "Sprint démarré";
            var message = $"Le sprint « {sprint.Name} » est maintenant actif.";

            foreach (var userId in recipientUserIds)
            {
                try
                {
                    await _notificationService.SendNotificationAsync(
                        userId, title, message, targetUrl, "sprint_started");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Échec de l'envoi de notification de démarrage du sprint {SprintId} à {UserId}.",
                        sprint.Id, userId);
                }
            }
        }

        private async Task SendEndingSoonNotificationsAsync(Sprint sprint, DateTime utcNow)
        {
            var recipientUserIds = await GetProjectRecipientIdsAsync(sprint.ProjectId);
            var targetUrl = $"/projects/{sprint.ProjectId}/backlog";

            var hoursLeft = Math.Max(1, (int)Math.Ceiling((sprint.EndDate!.Value - utcNow).TotalHours));
            var title = "Sprint se termine bientôt";
            var message = $"Le sprint « {sprint.Name} » se termine dans {hoursLeft}h "
                + $"(le {sprint.EndDate.Value:dd/MM/yyyy à HH:mm}).";

            var todayStart = DateTime.UtcNow.Date;

            foreach (var userId in recipientUserIds)
            {
                // Dédup : même mécanisme que DeadlineNotificationService
                var alreadySent = await _context.Notifications
                    .AsNoTracking()
                    .AnyAsync(n => n.UserId == userId
                        && n.Type == "sprint_ending_soon"
                        && n.TargetUrl == targetUrl
                        && n.CreatedAt >= todayStart);

                if (alreadySent) continue;

                try
                {
                    await _notificationService.SendNotificationAsync(
                        userId, title, message, targetUrl, "sprint_ending_soon");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Échec de l'envoi de notification de fin proche du sprint {SprintId} à {UserId}.",
                        sprint.Id, userId);
                }
            }
        }

        /// <summary>
        /// Récupère les IDs des ScrumMasters + Developers assignés + Admins globaux du projet.
        /// Même logique que DeadlineNotificationService pour les rôles project.
        /// </summary>
        private async Task<int[]> GetProjectRecipientIdsAsync(int projectId)
        {
            // ScrumMasters + Seniors du projet
            var projectRoleUserIds = await _context.ProjectMembers
                .AsNoTracking()
                .Where(pm => pm.ProjectId == projectId
                    && (pm.RoleInProject == "ScrumMaster"
                        || pm.RoleInProject == "Senior"))
                .Select(pm => pm.UserId)
                .ToListAsync();

            // Developers assignés via SprintMembers (uniques)
            var sprintMemberUserIds = await _context.SprintMembers
                .AsNoTracking()
                .Where(sm => sm.Sprint.ProjectId == projectId)
                .Select(sm => sm.UserId)
                .Distinct()
                .ToListAsync();

            // Fusion + dedup
            var allUserIds = projectRoleUserIds
                .Union(sprintMemberUserIds)
                .Distinct()
                .ToList();

            // Admins globaux pas déjà dans la liste
            var globalAdminIds = await _context.Users
                .AsNoTracking()
                .Where(u => u.Role.Description == "Admin"
                    && !allUserIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            allUserIds.AddRange(globalAdminIds);

            return allUserIds.ToArray();
        }
    }
}
