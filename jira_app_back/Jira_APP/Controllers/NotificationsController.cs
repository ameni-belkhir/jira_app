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

        public NotificationsController(INotificationService notificationService)
        {
            _notificationService = notificationService;
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
    }
}
