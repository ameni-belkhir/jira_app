using System;
using System.Collections.Generic;

namespace Application.DTO
{
    public class UserDto
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Prenom { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ProfileImageUrl { get; set; }
        // Added properties to align with Domain.Entity.User (non-sensitive)
        public int RoleId { get; set; }
        public DateTime DateInscription { get; set; }
        public bool IsEmailVerified { get; set; }

        public ICollection<int> ProjectIds { get; set; } = new List<int>();
        public ICollection<int> CreatedTicketIds { get; set; } = new List<int>();
        public ICollection<int> AssignedTicketIds { get; set; } = new List<int>();
        public ICollection<int> MessageIds { get; set; } = new List<int>();
        public ICollection<int> CommentaireIds { get; set; } = new List<int>();
    }
}
