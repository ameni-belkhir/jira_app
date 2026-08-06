using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Entity;


namespace Infrastructure.Persistence
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Project> Projects => Set<Project>();
        public DbSet<Sprint> Sprints => Set<Sprint>();
        public DbSet<Ticket> Tickets => Set<Ticket>();
        public DbSet<Invitation> Invitations => Set<Invitation>();
        public DbSet<Commentaire> Commentaires => Set<Commentaire>();
        public DbSet<Conversation> Conversations => Set<Conversation>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
        public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
        public DbSet<SprintMember> SprintMembers => Set<SprintMember>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<ChatConversation> ChatConversations => Set<ChatConversation>();
        public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
        public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Relations explicites pour éviter ambiguïtés lors des migrations

            // User - Role (many-to-one)
            modelBuilder.Entity<User>()
                .HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            // Project - Ticket (1 - N)
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tickets)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

// Project -> Creator (User) (N - 1)
            modelBuilder.Entity<Project>()
                .HasOne(p => p.Creator)
                .WithMany(u => u.CreatedProjects)
                .HasForeignKey(p => p.CreatedById)
                .OnDelete(DeleteBehavior.Restrict);

            // Project - Sprint (1 - N)
            modelBuilder.Entity<Project>()
                .HasMany(p => p.Sprints)
                .WithOne(s => s.Project)
                .HasForeignKey(s => s.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // ProjectMember (ex-join table anonyme, maintenant entité avec rôle)
            modelBuilder.Entity<ProjectMember>(entity =>
            {
                entity.HasKey(pm => new { pm.ProjectId, pm.UserId });

                entity.HasOne(pm => pm.Project)
                    .WithMany(p => p.Members)
                    .HasForeignKey(pm => pm.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(pm => pm.User)
                    .WithMany(u => u.ProjectMembers)
                    .HasForeignKey(pm => pm.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.Property(pm => pm.RoleInProject)
                    .HasMaxLength(50)
                    .IsRequired();

                entity.Property(pm => pm.JoinedAt)
                    .HasDefaultValueSql("GETUTCDATE()");
            });

            // SprintMember
            modelBuilder.Entity<SprintMember>(entity =>
            {
                entity.HasKey(sm => new { sm.SprintId, sm.UserId });

                entity.HasOne(sm => sm.Sprint)
                    .WithMany(s => s.SprintMembers)
                    .HasForeignKey(sm => sm.SprintId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(sm => sm.User)
                    .WithMany()
                    .HasForeignKey(sm => sm.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Ticket.Assignee (N - 1 User) optional
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.Assignee)
                .WithMany(u => u.AssignedTickets)
                .HasForeignKey(t => t.AssigneeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Ticket.Creator (N - 1 User) required
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.Creator)
                .WithMany(u => u.CreatedTickets)
                .HasForeignKey(t => t.CreatorId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            // Commentaire -> User (Author) and -> Ticket
            modelBuilder.Entity<Commentaire>()
                .HasOne(c => c.Author)
                .WithMany(u => u.Commentaires)
                .HasForeignKey(c => c.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Commentaire>()
                .HasOne(c => c.Ticket)
                .WithMany(t => t.Commentaires)
                .HasForeignKey(c => c.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            // Conversation -> Ticket (optional)
            modelBuilder.Entity<Conversation>()
                .HasOne(c => c.Ticket)
                .WithMany(t => t.Conversations)
                .HasForeignKey(c => c.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            // Sprint -> Tickets (1 - N) ; ticket.SprintId nullable => on delete set null (retour au backlog)
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.Sprint)
                .WithMany(s => s.Tickets)
                .HasForeignKey(t => t.SprintId)
                .OnDelete(DeleteBehavior.SetNull);

            // Ticket self-referencing (ParentTicket -> SubTickets)
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.ParentTicket)
                .WithMany(t => t.SubTickets)
                .HasForeignKey(t => t.ParentTicketId)
                .OnDelete(DeleteBehavior.Restrict);

            // Message -> Conversation and -> User (Sender)
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany(u => u.Messages)
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserPermission>(entity =>
            {
                entity.Property(permission => permission.InterfaceKey)
                    .HasMaxLength(50)
                    .IsRequired();

                entity.HasIndex(permission => new { permission.UserId, permission.InterfaceKey })
                    .IsUnique();

                entity.HasOne(permission => permission.User)
                    .WithMany(user => user.UserPermissions)
                    .HasForeignKey(permission => permission.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Notification
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.HasKey(n => n.Id);

                entity.Property(n => n.Title)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(n => n.Message)
                    .HasMaxLength(1000)
                    .IsRequired();

                entity.Property(n => n.Type)
                    .HasMaxLength(50);

                entity.Property(n => n.TargetUrl)
                    .HasMaxLength(500);

                entity.Property(n => n.CreatedAt)
                    .HasDefaultValueSql("GETUTCDATE()");

                entity.HasOne(n => n.User)
                    .WithMany()
                    .HasForeignKey(n => n.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(n => new { n.UserId, n.IsRead });
            });

            // ===== Messagerie temps réel (type Messenger/Slack) =====

            // ChatConversation -> Project (optionnel, Restrict pour ne pas supprimer les conversations)
            modelBuilder.Entity<ChatConversation>()
                .HasOne(c => c.Project)
                .WithMany()
                .HasForeignKey(c => c.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            // ConversationMember (table de liaison avec métadonnées : JoinedAt, LastReadAt)
            modelBuilder.Entity<ConversationMember>(entity =>
            {
                entity.HasKey(cm => new { cm.ConversationId, cm.UserId });

                entity.HasOne(cm => cm.Conversation)
                    .WithMany(c => c.Members)
                    .HasForeignKey(cm => cm.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(cm => cm.User)
                    .WithMany(u => u.ChatConversationMembers)
                    .HasForeignKey(cm => cm.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.Property(cm => cm.JoinedAt)
                    .HasDefaultValueSql("GETUTCDATE()");
            });

            // ChatMessage -> Conversation et -> User (Sender)
            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Sender)
                .WithMany(u => u.ChatMessages)
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ChatMessage>()
                .HasIndex(m => new { m.ConversationId, m.SentAt });

            modelBuilder.Entity<ChatMessage>()
                .HasIndex(m => new { m.ConversationId, m.SenderId, m.IsRead });

            // Pré-remplissage des rôles par défaut (Seeding)
            modelBuilder.Entity<Role>().HasData(
                new Role { Id = 1, Description = "Admin" },
                new Role { Id = 2, Description = "ScrumMaster" },
                new Role { Id = 3, Description = "Senior" },
                new Role { Id = 4, Description = "Developer" }
            );

            // Indexes for performance
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
            modelBuilder.Entity<Ticket>().HasIndex(t => t.ProjectId);
            modelBuilder.Entity<Ticket>().HasIndex(t => t.SprintId);
            modelBuilder.Entity<Ticket>().HasIndex(t => t.AssigneeId);
            modelBuilder.Entity<Invitation>().HasIndex(i => i.Token).IsUnique();
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            var newUsers = GetNewUsers();
            var result = base.SaveChanges(acceptAllChangesOnSuccess);
            return AddDefaultPermissions(newUsers) > 0
                ? result + base.SaveChanges(acceptAllChangesOnSuccess)
                : result;
        }

        public override async Task<int> SaveChangesAsync(
            bool acceptAllChangesOnSuccess,
            CancellationToken cancellationToken = default)
        {
            var newUsers = GetNewUsers();
            var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            return await AddDefaultPermissionsAsync(newUsers, cancellationToken) > 0
                ? result + await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken)
                : result;
        }

        private List<User> GetNewUsers() => ChangeTracker.Entries<User>()
            .Where(entry => entry.State == EntityState.Added)
            .Select(entry => entry.Entity)
            .ToList();

        private int AddDefaultPermissions(IReadOnlyCollection<User> newUsers)
        {
            if (newUsers.Count == 0) return 0;

            var roleNames = Roles.AsNoTracking()
                .Where(role => newUsers.Select(user => user.RoleId).Contains(role.Id))
                .ToDictionary(role => role.Id, role => role.Description);

            return CreateDefaultPermissions(newUsers, roleNames);
        }

        private async Task<int> AddDefaultPermissionsAsync(
            IReadOnlyCollection<User> newUsers,
            CancellationToken cancellationToken)
        {
            if (newUsers.Count == 0) return 0;

            var roleIds = newUsers.Select(user => user.RoleId).ToList();
            var roleNames = await Roles.AsNoTracking()
                .Where(role => roleIds.Contains(role.Id))
                .ToDictionaryAsync(role => role.Id, role => role.Description, cancellationToken);

            return CreateDefaultPermissions(newUsers, roleNames);
        }

        public async Task ResetUserPermissionsAsync(
            User user,
            string roleDescription,
            CancellationToken cancellationToken = default)
        {
            var existingPermissions = await UserPermissions
                .Where(permission => permission.UserId == user.Id)
                .ToListAsync(cancellationToken);

            UserPermissions.RemoveRange(existingPermissions);
            UserPermissions.AddRange(GetDefaultInterfaceKeys(roleDescription)
                .Select(interfaceKey => new UserPermission
                {
                    UserId = user.Id,
                    InterfaceKey = interfaceKey,
                    IsEnabled = true
                }));

            await SaveChangesAsync(cancellationToken);
        }

        private int CreateDefaultPermissions(
            IEnumerable<User> newUsers,
            IReadOnlyDictionary<int, string> roleNames)
        {
            var permissions = newUsers
                .Where(user => roleNames.ContainsKey(user.RoleId))
                .SelectMany(user => GetDefaultInterfaceKeys(roleNames[user.RoleId])
                    .Select(interfaceKey => new UserPermission
                    {
                        UserId = user.Id,
                        InterfaceKey = interfaceKey,
                        IsEnabled = true
                    }))
                .ToList();

            if (permissions.Count > 0) UserPermissions.AddRange(permissions);
            return permissions.Count;
        }

        private static IEnumerable<string> GetDefaultInterfaceKeys(string role) => role switch
        {
            "Admin" => InterfaceKeys.All,
            "ScrumMaster" => InterfaceKeys.All.Where(key => key is not InterfaceKeys.AdminUsers and not InterfaceKeys.AdminProjects and not InterfaceKeys.AdminStatistics),
            "Senior" => new[]
            {
                InterfaceKeys.Dashboard,
                InterfaceKeys.Projects,
                InterfaceKeys.Statistics,
                InterfaceKeys.Chat,
                InterfaceKeys.Backlog,
                InterfaceKeys.Kanban,
                InterfaceKeys.Profile
            },
            "Developer" => new[]
            {
                InterfaceKeys.Dashboard,
                InterfaceKeys.Kanban,
                InterfaceKeys.Chat,
                InterfaceKeys.Profile
            },
            _ => Array.Empty<string>()
        };
    }
}
