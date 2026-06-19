# apps/api/v1/auth/serializers.py
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from apps.main.models import UserProfile


class RestrictedRegisterSerializer(RegisterSerializer):
    pass


class UserProfileSerializer(serializers.ModelSerializer):
    company_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "company",
            "company_logo",
            "company_logo_url",
            "report_prepared_by",
        )
        read_only_fields = ("company_logo_url",)

    def get_company_logo_url(self, obj):
        if not obj.company_logo:
            return None

        request = self.context.get("request")
        url = obj.company_logo.url
        if request:
            return request.build_absolute_uri(url)
        return url


class CurrentUserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True, allow_blank=True)
    last_name = serializers.CharField(read_only=True, allow_blank=True)
    profile = UserProfileSerializer(read_only=True)

    def to_representation(self, instance):
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        instance.profile = profile
        return super().to_representation(instance)


class UpdateCurrentUserSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    company = serializers.CharField(required=False, allow_blank=True, max_length=150)
    company_logo = serializers.FileField(required=False, allow_null=True)
    report_prepared_by = serializers.CharField(required=False, allow_blank=True, max_length=150)
    remove_company_logo = serializers.BooleanField(required=False, default=False)

    def update(self, instance, validated_data):
        profile, _ = UserProfile.objects.get_or_create(user=instance)

        for field in ("first_name", "last_name"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])

        if any(field in validated_data for field in ("first_name", "last_name")):
            instance.save(update_fields=["first_name", "last_name"])

        if "company" in validated_data:
            profile.company = validated_data["company"]

        if "report_prepared_by" in validated_data:
            profile.report_prepared_by = validated_data["report_prepared_by"]

        if validated_data.get("remove_company_logo") and profile.company_logo:
            profile.company_logo.delete(save=False)
            profile.company_logo = None

        if "company_logo" in validated_data:
            profile.company_logo = validated_data["company_logo"]

        profile.save()
        return instance
