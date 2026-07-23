using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UpdateCommentaireDto
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public string Contenu { get; set; } = string.Empty;

        [Required]
        public int AuthorId { get; set; }

        public int? TicketId { get; set; }
    }
}
