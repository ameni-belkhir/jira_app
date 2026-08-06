namespace Domain.Entity
{
    public class UserPermission
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;
        public string InterfaceKey { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }
}
