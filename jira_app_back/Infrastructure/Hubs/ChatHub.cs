using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.DTO.Chat;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private const string ReceiveMessageMethod = "ReceiveMessage";
        private const string UserTypingStatusMethod = "UserTypingStatus";
        private const string MessagesReadMethod = "MessagesRead";
        private const string UserPresenceChangedMethod = "UserPresenceChanged";
        private const string MessageEditedMethod = "MessageEdited";
        private const string MessageDeletedMethod = "MessageDeleted";

        private static readonly ConcurrentDictionary<int, HashSet<string>> _userConnections = new();

        private readonly IChatService _chatService;
        private readonly ILogger<ChatHub> _logger;

        public ChatHub(IChatService chatService, ILogger<ChatHub> logger)
        {
            _chatService = chatService;
            _logger = logger;
        }

        private int? GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !int.TryParse(claim, out var id))
                return null;
            return id;
        }

        private static string GroupName(Guid conversationId) => $"conv-{conversationId}";

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId != null)
            {
                var connections = _userConnections.GetOrAdd(userId.Value, _ => new HashSet<string>());
                bool wasOffline;
                lock (connections)
                {
                    wasOffline = connections.Count == 0;
                    connections.Add(Context.ConnectionId);
                }

                await Groups.AddToGroupAsync(Context.ConnectionId, userId.Value.ToString());

                if (wasOffline)
                {
                    _logger.LogInformation("Chat : utilisateur {UserId} en ligne.", userId);
                    await Clients.All.SendAsync(UserPresenceChangedMethod, userId.Value, true);
                }
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            if (userId != null)
            {
                if (_userConnections.TryGetValue(userId.Value, out var connections))
                {
                    bool isNowOffline;
                    lock (connections)
                    {
                        connections.Remove(Context.ConnectionId);
                        isNowOffline = connections.Count == 0;
                        if (isNowOffline)
                            _userConnections.TryRemove(userId.Value, out _);
                    }

                    if (isNowOffline)
                    {
                        _logger.LogInformation("Chat : utilisateur {UserId} hors ligne.", userId);
                        await Clients.All.SendAsync(UserPresenceChangedMethod, userId.Value, false);
                    }
                }

                await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId.Value.ToString());
            }

            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// Abonne la connexion aux événements d'une conversation (Reçoit les messages/typing).
        /// Doit être appelé par le client à l'ouverture d'une conversation.
        /// </summary>
        public async Task JoinConversation(Guid conversationId)
        {
            var userId = GetUserId();
            if (userId == null || !await _chatService.IsMemberAsync(userId.Value, conversationId))
                return;

            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(conversationId));
        }

        public async Task LeaveConversation(Guid conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(conversationId));
        }

        public async Task SendMessage(Guid conversationId, string content, string? attachmentUrl = null)
        {
            var userId = GetUserId();
            if (userId == null) return;

            var message = await _chatService.SendMessageAsync(userId.Value, conversationId, content, attachmentUrl);
            if (message == null)
            {
                _logger.LogWarning("Chat : envoi refusé pour {UserId} dans {ConversationId}.", userId, conversationId);
                return;
            }

            // Diffusion unique au groupe : l'expéditeur y est déjà inscrit (JoinConversation),
            // donc aucun écho Clients.Caller n'est nécessaire pour éviter les doublons.
            await Clients.Group(GroupName(conversationId)).SendAsync(ReceiveMessageMethod, message);
        }

        /// <summary>
        /// Modifie un message (l'expéditeur ou l'Admin global) et diffuse le message mis à jour.
        /// </summary>
        public async Task EditMessage(Guid conversationId, Guid messageId, string content)
        {
            var userId = GetUserId();
            if (userId == null) return;

            var isAdmin = Context.User?.IsInRole("Admin") ?? false;
            var updated = await _chatService.EditMessageAsync(userId.Value, isAdmin, conversationId, messageId, content);
            if (updated == null)
            {
                _logger.LogWarning("Chat : modification refusée pour {UserId} (msg {MessageId}).", userId, messageId);
                return;
            }

            await Clients.Group(GroupName(conversationId)).SendAsync(MessageEditedMethod, updated);
        }

        /// <summary>
        /// Supprime un message (l'expéditeur ou l'Admin global) et diffuse la suppression.
        /// </summary>
        public async Task DeleteMessage(Guid conversationId, Guid messageId)
        {
            var userId = GetUserId();
            if (userId == null) return;

            var isAdmin = Context.User?.IsInRole("Admin") ?? false;
            var ok = await _chatService.DeleteMessageAsync(userId.Value, isAdmin, conversationId, messageId);
            if (!ok)
            {
                _logger.LogWarning("Chat : suppression refusée pour {UserId} (msg {MessageId}).", userId, messageId);
                return;
            }

            await Clients.Group(GroupName(conversationId)).SendAsync(MessageDeletedMethod, conversationId, messageId);
        }

        public async Task StartTyping(Guid conversationId)
        {
            await BroadcastTypingStatus(conversationId, true);
        }

        public async Task StopTyping(Guid conversationId)
        {
            await BroadcastTypingStatus(conversationId, false);
        }

        private async Task BroadcastTypingStatus(Guid conversationId, bool isTyping)
        {
            var userId = GetUserId();
            if (userId == null || !await _chatService.IsMemberAsync(userId.Value, conversationId))
                return;

            var userName = Context.User?.FindFirst("FullName")?.Value ?? string.Empty;

            // Diffusion aux AUTRES membres uniquement : l'expéditeur n'a pas besoin de son propre statut.
            await Clients.OthersInGroup(GroupName(conversationId))
                .SendAsync(UserTypingStatusMethod, new
                {
                    ConversationId = conversationId,
                    UserId = userId.Value,
                    UserName = userName,
                    IsTyping = isTyping
                });
        }

        public async Task MarkAsRead(Guid conversationId, Guid messageId)
        {
            var userId = GetUserId();
            if (userId == null) return;

            var ok = await _chatService.MarkMessagesReadAsync(userId.Value, conversationId);
            if (!ok) return;

            await Clients.Group(GroupName(conversationId))
                .SendAsync(MessagesReadMethod, conversationId, userId.Value, messageId);
        }

        public static bool IsUserOnline(int userId)
            => _userConnections.TryGetValue(userId, out var connections) && connections.Count > 0;
    }
}
