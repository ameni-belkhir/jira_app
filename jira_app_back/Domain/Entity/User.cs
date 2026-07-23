using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Entity
{
    public class User
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Prenom { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public DateTime DateInscription { get; set; } = DateTime.UtcNow;

        // Clé étrangère et propriété de navigation vers Role
        public int RoleId { get; set; }
        public Role Role { get; set; } = null!;

        // Relations
        // Memberships to projects (many-to-many)
        public ICollection<Project> Projects { get; set; } = new List<Project>();

        // Tickets created by this user (one-to-many)
        public ICollection<Ticket> CreatedTickets { get; set; } = new List<Ticket>();

        // Tickets assigned to this user (one-to-many)
        public ICollection<Ticket> AssignedTickets { get; set; } = new List<Ticket>();

        // Messages sent by this user
        public ICollection<Message> Messages { get; set; } = new List<Message>();

        // Commentaires rédigés par cet utilisateur
        public ICollection<Commentaire> Commentaires { get; set; } = new List<Commentaire>();

        // Email verification & password reset
        public string? VerificationCode { get; set; }
        public DateTime? VerificationCodeExpiration { get; set; }
        public bool IsEmailVerified { get; set; } = false;

        public string? ResetPasswordToken { get; set; }
        public DateTime? ResetPasswordExpiration { get; set; }

        // Profile image URL relative to wwwroot (ex: /uploads/profiles/filename.png)
        public string? ProfileImageUrl { get; set; }
    }
}
