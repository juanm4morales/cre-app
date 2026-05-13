from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password as django_validate_password
from rest_framework import serializers


User = get_user_model()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if not username or not password:
            raise serializers.ValidationError("Credenciales incompletas.")

        candidate = username
        if "@" in username:
            user_by_email = User.objects.filter(email__iexact=username).first()
            if user_by_email:
                candidate = user_by_email.username

        user = authenticate(username=candidate, password=password)
        if not user:
            raise serializers.ValidationError("Usuario o contrasena invalida.")

        if not user.is_active:
            raise serializers.ValidationError("El usuario esta inactivo.")

        attrs["user"] = user
        return attrs

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "is_active", "role"]

    def get_role(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile:
            return "docente"
        return "admin" if profile.role == "ADMIN" else "docente"


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        django_validate_password(value)
        return value

    class Meta:
        model = User
        fields = ["username", "password", "first_name", "last_name", "email"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        profile = getattr(user, "profile", None)
        if profile:
            profile.role = "DOCENTE"
            profile.save(update_fields=["role"])

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    def validate_password(self, value):
        django_validate_password(value)
        return value

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "is_active", "password"]

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
