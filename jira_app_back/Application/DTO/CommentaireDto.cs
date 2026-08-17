using System;

namespace Application.DTO
{
    public class CommentaireDto
    {
        public int Id { get; set; }
        public string Contenu { get; set; } = string.Empty;
        public int AuthorId { get; set; }
        public int? TicketId { get; set; }
        public DateTime DateCreation { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string? AuthorAvatarUrl { get; set; }
        public string? Role { get; set; }
    }
}
