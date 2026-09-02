using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO.Chat;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class ChatService : IChatService
    {
        private readonly IChatRepository _chatRepository;
        private readonly IUserRepository _userRepository;

        public ChatService(IChatRepository chatRepository, IUserRepository userRepository)
        {
            _chatRepository = chatRepository;
            _userRepository = userRepository;
        }

        public async Task<IEnumerable<ChatConversationDto>> GetUserConversationsAsync(int userId)
        {
            var conversations = await _chatRepository.GetUserConversationsAsync(userId);

            var result = new List<ChatConversationDto>();
            foreach (var conversation in conversations)
            {
                var unread = await _chatRepository.GetUnreadCountAsync(conversation.Id, userId);
                result.Add(MapConversation(conversation, userId, unread));
            }

            return result;
        }

        public async Task<ChatConversationDto?> GetConversationAsync(Guid conversationId, int userId)
        {
            var conversation = await _chatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null || !conversation.Members.Any(m => m.UserId == userId))
                return null;

            var unread = await _chatRepository.GetUnreadCountAsync(conversationId, userId);
            return MapConversation(conversation, userId, unread);
        }

        public async Task<IEnumerable<ChatMessageDto>> GetMessagesAsync(Guid conversationId, int userId, int page, int pageSize)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 200) pageSize = 30;

            if (!await _chatRepository.IsMemberAsync(conversationId, userId))
                return Enumerable.Empty<ChatMessageDto>();

            var messages = await _chatRepository.GetMessagesAsync(conversationId, page, pageSize);
            return messages
                .OrderBy(m => m.SentAt)
                .Select(MapMessage)
                .ToList();
        }

        public async Task<ChatConversationDto> CreateConversationAsync(int creatorUserId, CreateChatConversationDto dto)
        {
            var memberIds = dto.MemberUserIds
                .Where(id => id != creatorUserId)
                .Distinct()
                .ToList();

            // Garde : interdit la création d'une conversation sans autre membre (soi-même seul).
            // Le backend ne doit jamais créer de conversation à 1 seul membre.
            if (memberIds.Count == 0)
                throw new InvalidOperationException("Une conversation doit inclure au moins un autre participant.");

            foreach (var memberId in memberIds)
            {
                if (await _userRepository.GetByIdAsync(memberId) == null)
                    throw new InvalidOperationException($"L'utilisateur {memberId} n'existe pas.");
            }

            // Déduplication 1:1 — si une conversation directe existe déjà entre les deux users, la retourner.
            if (!dto.IsGroup && memberIds.Count == 1)
            {
                var existing = await _chatRepository.FindDirectConversationAsync(creatorUserId, memberIds[0]);
                if (existing != null)
                    return MapConversation(existing, creatorUserId, 0);
            }

            var conversation = new ChatConversation
            {
                Name = dto.Name,
                IsGroup = dto.IsGroup,
                ProjectId = dto.ProjectId,
                CreatedAt = DateTime.UtcNow
            };

            conversation.Members.Add(new ConversationMember
            {
                UserId = creatorUserId,
                JoinedAt = DateTime.UtcNow,
                LastReadAt = DateTime.UtcNow
            });

            foreach (var memberId in memberIds)
            {
                conversation.Members.Add(new ConversationMember
                {
                    UserId = memberId,
                    JoinedAt = DateTime.UtcNow
                });
            }

            await _chatRepository.AddConversationAsync(conversation);
            await _chatRepository.SaveChangesAsync();

            var created = await _chatRepository.GetConversationByIdAsync(conversation.Id);
            return MapConversation(created!, creatorUserId, 0);
        }

        public async Task<bool> AddMemberAsync(Guid conversationId, int requesterUserId, int memberUserId)
        {
            if (await _userRepository.GetByIdAsync(memberUserId) == null) return false;
            if (!await _chatRepository.IsMemberAsync(conversationId, requesterUserId)) return false;
            if (await _chatRepository.IsMemberAsync(conversationId, memberUserId)) return false;

            var conversation = await _chatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null) return false;

            await _chatRepository.AddMemberAsync(new ConversationMember
            {
                ConversationId = conversationId,
                UserId = memberUserId,
                JoinedAt = DateTime.UtcNow
            });

            await _chatRepository.SaveChangesAsync();
            return true;
        }

        public async Task<ChatMessageDto?> SendMessageAsync(int senderId, Guid conversationId, string content, string? attachmentUrl)
        {
            if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(attachmentUrl))
                return null;

            if (!await _chatRepository.IsMemberAsync(conversationId, senderId))
                return null;

            var message = new ChatMessage
            {
                ConversationId = conversationId,
                SenderId = senderId,
                Content = content?.Trim() ?? string.Empty,
                AttachmentUrl = attachmentUrl,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            await _chatRepository.AddMessageAsync(message);
            await _chatRepository.SaveChangesAsync();

            var created = await _chatRepository.GetMessageByIdAsync(message.Id);
            return MapMessage(created!);
        }

        public async Task<ChatMessageDto?> EditMessageAsync(int requesterUserId, bool isAdmin, Guid conversationId, Guid messageId, string content)
        {
            if (string.IsNullOrWhiteSpace(content)) return null;

            var message = await _chatRepository.GetMessageByIdAsync(messageId);
            if (message == null || message.ConversationId != conversationId) return null;

            // Seul l'expéditeur peut modifier son message, sauf l'Admin global (permission suprême).
            if (!isAdmin)
            {
                if (!await _chatRepository.IsMemberAsync(conversationId, requesterUserId)) return null;
                if (message.SenderId != requesterUserId) return null;
            }

            message.Content = content.Trim();
            await _chatRepository.SaveChangesAsync();

            var updated = await _chatRepository.GetMessageByIdAsync(messageId);
            return MapMessage(updated!);
        }

        public async Task<bool> DeleteMessageAsync(int requesterUserId, bool isAdmin, Guid conversationId, Guid messageId)
        {
            var message = await _chatRepository.GetMessageByIdAsync(messageId);
            if (message == null || message.ConversationId != conversationId) return false;

            // Seul l'expéditeur peut supprimer son message, sauf l'Admin global (permission suprême).
            if (!isAdmin)
            {
                if (!await _chatRepository.IsMemberAsync(conversationId, requesterUserId)) return false;
                if (message.SenderId != requesterUserId) return false;
            }

            await _chatRepository.RemoveMessageAsync(message);
            await _chatRepository.SaveChangesAsync();
            return true;
        }

        public async Task<bool> MarkMessagesReadAsync(int userId, Guid conversationId)
        {
            if (!await _chatRepository.IsMemberAsync(conversationId, userId))
                return false;

            await _chatRepository.MarkMessagesReadAsync(conversationId, userId);
            await _chatRepository.SaveChangesAsync();
            return true;
        }

        public async Task<bool> IsMemberAsync(int userId, Guid conversationId)
        {
            return await _chatRepository.IsMemberAsync(conversationId, userId);
        }

        private static ChatMessageDto MapMessage(ChatMessage message)
        {
            return new ChatMessageDto
            {
                Id = message.Id,
                ConversationId = message.ConversationId,
                SenderId = message.SenderId,
                SenderName = message.Sender == null
                    ? "Utilisateur"
                    : $"{message.Sender.Prenom} {message.Sender.Nom}".Trim(),
                SenderAvatar = message.Sender?.ProfileImageUrl ?? string.Empty,
                Content = message.Content,
                SentAt = message.SentAt,
                AttachmentUrl = message.AttachmentUrl,
                IsRead = message.IsRead
            };
        }

        private ChatConversationDto MapConversation(ChatConversation conversation, int currentUserId, int unreadCount)
        {
            var members = conversation.Members
                .OrderBy(m => m.UserId)
                .Select(m => new ChatUserDto
                {
                    Id = m.UserId,
                    Nom = m.User?.Nom ?? string.Empty,
                    Prenom = m.User?.Prenom ?? string.Empty,
                    Email = m.User?.Email ?? string.Empty,
                    ProfileImageUrl = m.User?.ProfileImageUrl
                })
                .ToList();

            // Pour un échange 1:1, le nom affiché est celui de l'interlocuteur
            var displayName = conversation.Name;
            if (!conversation.IsGroup)
            {
                var other = conversation.Members.FirstOrDefault(m => m.UserId != currentUserId);
                if (other?.User != null)
                    displayName = $"{other.User.Prenom} {other.User.Nom}".Trim();
            }

            var lastMessage = conversation.Messages
                .OrderByDescending(m => m.SentAt)
                .FirstOrDefault();

            return new ChatConversationDto
            {
                Id = conversation.Id,
                Name = displayName,
                IsGroup = conversation.IsGroup,
                ProjectId = conversation.ProjectId,
                CreatedAt = conversation.CreatedAt,
                Members = members,
                LastMessage = lastMessage == null ? null : MapMessage(lastMessage),
                UnreadCount = unreadCount
            };
        }
    }
}
