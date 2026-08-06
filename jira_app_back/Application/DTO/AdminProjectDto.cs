namespace Application.DTO
{
    public class AdminProjectDto
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Responsable { get; set; } = string.Empty;
        public int MemberCount { get; set; }
        public int SprintCount { get; set; }
        public int TicketCount { get; set; }
    }
}
