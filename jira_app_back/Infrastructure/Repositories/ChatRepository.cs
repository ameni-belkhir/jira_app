using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Domain.Entity;
using Domain.Interfaces;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories
{
    public class ChatRepository : IChatRepository
    {
        private readonly ApplicationDbContext _context;

        public ChatRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<ChatConversation?> GetConversationByIdAsync(Guid conversationId)
        {
            return await _context.ChatConversations
                .AsNoTracking()
                .Include(c => c.Members)
                    .ThenInclude(m => m.User)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .FirstOrDefaultAsync(c => c.Id == conversationId);
        }

        public async Task<IEnumerable<ChatConversation>> GetUserConversationsAsync(int userId)
        {
            var conversations = await _context.ChatConversations
                .AsNoTracking()
                .Where(c => c.Members.Any(m => m.UserId == userId))
                .Include(c => c.Members)
                    .ThenInclude(m => m.User)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .ToListAsync();

            return conversations
                .OrderByDescending(c => c.Messages.Count == 0
                    ? c.CreatedAt
                    : c.Messages.Max(m => m.SentAt));
        }

        public async Task<ChatMessage?> GetMessageByIdAsync(Guid messageId)
        {
            return await _context.ChatMessages
                .AsNoTracking()
                .Include(m => m.Sender)
                .FirstOrDefaultAsync(m => m.Id == messageId);
        }

        public async Task<IEnumerable<ChatMessage>> GetMessagesAsync(Guid conversationId, int page, int pageSize)
        {
            return await _context.ChatMessages
                .AsNoTracking()
                .Include(m => m.Sender)
                .Where(m => m.ConversationId == conversationId)
                .OrderByDescending(m => m.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<int> GetMessagesCountAsync(Guid conversationId)
        {
            return await _context.ChatMessages
                .CountAsync(m => m.ConversationId == conversationId);
        }

        public async Task<IEnumerable<ConversationMember>> GetConversationMembersAsync(Guid conversationId)
        {
            return await _context.ConversationMembers
                .AsNoTracking()
                .Include(m => m.User)
                .Where(m => m.ConversationId == conversationId)
                .ToListAsync();
        }

        public async Task<ConversationMember?> GetMembershipAsync(Guid conversationId, int userId)
        {
            return await _context.ConversationMembers
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.ConversationId == conversationId && m.UserId == userId);
        }

        public async Task<IEnumerable<int>> GetMemberUserIdsAsync(Guid conversationId)
        {
            return await _context.ConversationMembers
                .AsNoTracking()
                .Where(m => m.ConversationId == conversationId)
                .Select(m => m.UserId)
                .ToListAsync();
        }

        public async Task<bool> IsMemberAsync(Guid conversationId, int userId)
        {
            return await _context.ConversationMembers
                .AsNoTracking()
                .AnyAsync(m => m.ConversationId == conversationId && m.UserId == userId);
        }

        public async Task<int> GetUnreadCountAsync(Guid conversationId, int userId)
        {
            return await _context.ChatMessages
                .CountAsync(m => m.ConversationId == conversationId
                                 && m.SenderId != userId
                                 && !m.IsRead);
        }

        public async Task AddConversationAsync(ChatConversation conversation)
        {
            await _context.ChatConversations.AddAsync(conversation);
        }

        public async Task<ChatConversation?> FindDirectConversationAsync(int userId1, int userId2)
        {
            return await _context.ChatConversations
                .AsNoTracking()
                .Where(c => !c.IsGroup
                    && c.Members.Any(m => m.UserId == userId1)
                    && c.Members.Any(m => m.UserId == userId2))
                .Include(c => c.Members)
                    .ThenInclude(m => m.User)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .FirstOrDefaultAsync();
        }

        public async Task AddMemberAsync(ConversationMember member)
        {
            await _context.ConversationMembers.AddAsync(member);
        }

        public async Task AddMessageAsync(ChatMessage message)
        {
            await _context.ChatMessages.AddAsync(message);
        }

        public Task RemoveMessageAsync(ChatMessage message)
        {
            _context.ChatMessages.Remove(message);
            return Task.CompletedTask;
        }

        public async Task MarkMessagesReadAsync(Guid conversationId, int userId)
        {
            var messages = await _context.ChatMessages
                .Where(m => m.ConversationId == conversationId && m.SenderId != userId && !m.IsRead)
                .ToListAsync();

            foreach (var message in messages)
            {
                message.IsRead = true;
            }

            var membership = await _context.ConversationMembers
                .FirstOrDefaultAsync(m => m.ConversationId == conversationId && m.UserId == userId);

            if (membership != null)
            {
                membership.LastReadAt = DateTime.UtcNow;
            }
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
