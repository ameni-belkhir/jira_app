using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO.Chat;

namespace Application.Interfaces
{
    public interface IChatService
    {
        Task<IEnumerable<ChatConversationDto>> GetUserConversationsAsync(int userId);
        Task<ChatConversationDto?> GetConversationAsync(Guid conversationId, int userId);
        Task<IEnumerable<ChatMessageDto>> GetMessagesAsync(Guid conversationId, int userId, int page, int pageSize);
        Task<ChatConversationDto> CreateConversationAsync(int creatorUserId, CreateChatConversationDto dto);
        Task<bool> AddMemberAsync(Guid conversationId, int requesterUserId, int memberUserId);
        Task<ChatMessageDto?> SendMessageAsync(int senderId, Guid conversationId, string content, string? attachmentUrl);
        Task<bool> MarkMessagesReadAsync(int userId, Guid conversationId);
        Task<bool> IsMemberAsync(int userId, Guid conversationId);
    }
}
