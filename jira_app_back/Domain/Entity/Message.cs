using System;

namespace Domain.Entity
{
    public class Message
    {
        public int Id { get; set; }
        public int SenderId { get; set; }
        public User? Sender { get; set; }
        public string Contenu { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; } = DateTime.UtcNow;
        public bool Lu { get; set; } = false;

        public int ConversationId { get; set; }
        public Conversation? Conversation { get; set; }
    }
}
