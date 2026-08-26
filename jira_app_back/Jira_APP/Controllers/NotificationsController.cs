using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _notificationService;
        private readonly IDeadlineNotificationService _deadlineNotificationService;

        public NotificationsController(
            INotificationService notificationService,
            IDeadlineNotificationService deadlineNotificationService)
        {
            _notificationService = notificationService;
            _deadlineNotificationService = deadlineNotificationService;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !int.TryParse(claim, out var id)) return null;
            return id;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NotificationDto>>> Get()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var items = await _notificationService.GetUserNotificationsAsync(userId.Value);
            return Ok(items);
        }

        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var ok = await _notificationService.MarkAsReadAsync(id, userId.Value);
            if (!ok) return NotFound();
            return NoContent();
        }

        /// <summary>
        /// Marque toutes les notifications non lues de l'utilisateur courant comme lues.
        /// </summary>
        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            await _notificationService.MarkAllAsReadAsync(userId.Value);
            return NoContent();
        }

        /// <summary>
        /// Supprime définitivement toutes les notifications déjà lues de l'utilisateur courant.
        /// </summary>
        [HttpDelete("read")]
        public async Task<IActionResult> DeleteRead()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            await _notificationService.DeleteReadNotificationsAsync(userId.Value);
            return NoContent();
        }

        /// <summary>
        /// Déclenche manuellement le scan des échéances proches/dépassées et l'envoi
        /// des notifications associées (même logique que le BackgroundService).
        /// Appelé à la demande par le frontend au chargement du dashboard.
        /// </summary>
        [HttpPost("run-deadline-check")]
        public async Task<IActionResult> RunDeadlineCheck()
        {
            await _deadlineNotificationService.CheckAndSendDeadlineNotificationsAsync();
            return NoContent();
        }
    }
}
