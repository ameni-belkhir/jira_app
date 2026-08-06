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

            // Diffusion à toute la conversation (y compris autres appareils de l'expéditeur)
            await Clients.Group(GroupName(conversationId)).SendAsync(ReceiveMessageMethod, message);
            await Clients.Caller.SendAsync(ReceiveMessageMethod, message);
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

            await Clients.OthersInGroup(GroupName(conversationId))
                .SendAsync(UserTypingStatusMethod, conversationId, userId.Value, isTyping);
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
