from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
	class Role(models.TextChoices):
		ADMIN = "ADMIN", "Admin"
		DOCENTE = "DOCENTE", "Docente"

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="profile",
	)
	role = models.CharField(
		max_length=20,
		choices=Role.choices,
		default=Role.DOCENTE,
	)

	class Meta:
		verbose_name = "perfil de usuario"
		verbose_name_plural = "perfiles de usuario"
		db_table = "accounts_user_profile"

	def __str__(self):
		return f"{self.user} ({self.role})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
	if created:
		UserProfile.objects.create(user=instance)
