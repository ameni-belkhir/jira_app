using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Domain.Entity;

namespace Domain.Interfaces
{
    public interface IChatRepository
    {
        Task<ChatConversation?> GetConversationByIdAsync(Guid conversationId);
        Task<IEnumerable<ChatConversation>> GetUserConversationsAsync(int userId);
        Task<ChatMessage?> GetMessageByIdAsync(Guid messageId);
        Task<IEnumerable<ChatMessage>> GetMessagesAsync(Guid conversationId, int page, int pageSize);
        Task<int> GetMessagesCountAsync(Guid conversationId);
        Task<IEnumerable<ConversationMember>> GetConversationMembersAsync(Guid conversationId);
        Task<ConversationMember?> GetMembershipAsync(Guid conversationId, int userId);
        Task<IEnumerable<int>> GetMemberUserIdsAsync(Guid conversationId);
        Task<bool> IsMemberAsync(Guid conversationId, int userId);
        Task<int> GetUnreadCountAsync(Guid conversationId, int userId);
        Task AddConversationAsync(ChatConversation conversation);
        Task AddMemberAsync(ConversationMember member);
        Task AddMessageAsync(ChatMessage message);
        Task MarkMessagesReadAsync(Guid conversationId, int userId);
        Task SaveChangesAsync();
    }
}
