using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.DTO.Chat;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/chat")]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IFileStorageService _fileStorageService;
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            IChatService chatService,
            IFileStorageService fileStorageService,
            ILogger<ChatController> logger)
        {
            _chatService = chatService;
            _fileStorageService = fileStorageService;
            _logger = logger;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !int.TryParse(claim, out var id)) return null;
            return id;
        }

        /// <summary>
        /// Conversations de l'utilisateur avec le dernier message et le nombre de non lus.
        /// </summary>
        [HttpGet("conversations")]
        public async Task<ActionResult<IEnumerable<ChatConversationDto>>> GetConversations()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var conversations = await _chatService.GetUserConversationsAsync(userId.Value);
            return Ok(conversations);
        }

        /// <summary>
        /// Détails d'une conversation (si l'utilisateur en est membre).
        /// </summary>
        [HttpGet("conversations/{id:guid}")]
        public async Task<ActionResult<ChatConversationDto>> GetConversation(Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var conversation = await _chatService.GetConversationAsync(id, userId.Value);
            if (conversation == null) return NotFound();
            return Ok(conversation);
        }

        /// <summary>
        /// Historique paginé des messages d'une conversation (trié du plus ancien au plus récent).
        /// </summary>
        [HttpGet("conversations/{id:guid}/messages")]
        public async Task<ActionResult<IEnumerable<ChatMessageDto>>> GetMessages(
            Guid id,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 30)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var messages = await _chatService.GetMessagesAsync(id, userId.Value, page, pageSize);
            return Ok(messages);
        }

        /// <summary>
        /// Crée une conversation (1:1 ou groupe). Le créateur devient membre automatiquement.
        /// </summary>
        [HttpPost("conversations")]
        public async Task<ActionResult<ChatConversationDto>> CreateConversation([FromBody] CreateChatConversationDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            if (!ModelState.IsValid) return BadRequest(ModelState);

            try
            {
                var created = await _chatService.CreateConversationAsync(userId.Value, dto);
                return CreatedAtAction(nameof(GetConversation), new { id = created.Id }, created);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// Ajoute un membre à une conversation existante (réservé aux membres actuels).
        /// </summary>
        [HttpPost("conversations/{id:guid}/members")]
        public async Task<IActionResult> AddMember(Guid id, [FromBody] AddConversationMemberDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var ok = await _chatService.AddMemberAsync(id, userId.Value, dto.UserId);
            if (!ok) return BadRequest(new { error = "Ajout impossible : conversation introuvable, utilisateur inexistant, non-membre ou déjà membre." });
            return NoContent();
        }

        /// <summary>
        /// Modifie un message (l'expéditeur ou l'Admin global).
        /// </summary>
        [HttpPut("conversations/{conversationId:guid}/messages/{messageId:guid}")]
        public async Task<ActionResult<ChatMessageDto>> EditMessage(Guid conversationId, Guid messageId, [FromBody] UpdateChatMessageDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var updated = await _chatService.EditMessageAsync(userId.Value, User.IsInRole("Admin"), conversationId, messageId, dto.Content);
            if (updated == null) return NotFound();
            return Ok(updated);
        }

        /// <summary>
        /// Supprime un message (l'expéditeur ou l'Admin global).
        /// </summary>
        [HttpDelete("conversations/{conversationId:guid}/messages/{messageId:guid}")]
        public async Task<IActionResult> DeleteMessage(Guid conversationId, Guid messageId)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var ok = await _chatService.DeleteMessageAsync(userId.Value, User.IsInRole("Admin"), conversationId, messageId);
            if (!ok) return NotFound();
            return NoContent();
        }

        /// <summary>
        /// Enregistre une pièce jointe (fichier) et retourne son URL servie par wwwroot.
        /// </summary>
        [HttpPost("upload")]
        [RequestSizeLimit(20 * 1024 * 1024)] // 20 Mo max
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Aucun fichier reçu." });

            try
            {
                var url = await _fileStorageService.SaveChatAttachmentAsync(file);
                return Ok(new { url });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Échec de l'upload de pièce jointe chat.");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Impossible d'enregistrer le fichier." });
            }
        }
    }
}
