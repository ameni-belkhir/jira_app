using System;

namespace Domain.Entity
{
    public class ChatMessage
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ConversationId { get; set; }
        public ChatConversation? Conversation { get; set; }

        public int SenderId { get; set; }
        public User? Sender { get; set; }

        public string Content { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public string? AttachmentUrl { get; set; }
        public bool IsRead { get; set; }
    }
}
