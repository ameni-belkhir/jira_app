namespace Application.DTO
{
    public class SprintTicketDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? AssignedTo { get; set; }
        public string? AssignedToAvatar { get; set; }
        public string Color { get; set; } = "#ffffff";
        public DateTime? DateEcheance { get; set; }
        public bool HasSubTickets { get; set; }
        public int? ParentTicketId { get; set; }

        // Hiérarchie : sous-tickets imbriqués (récursif)
        public List<SprintTicketDto> SubTickets { get; set; } = new();
    }
}