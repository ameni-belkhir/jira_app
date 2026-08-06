using System;

namespace Domain.Entity
{
    public class ConversationMember
    {
        public Guid ConversationId { get; set; }
        public ChatConversation? Conversation { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        // Dernière lecture de la conversation par ce membre (null si jamais lu)
        public DateTime? LastReadAt { get; set; }
    }
}
