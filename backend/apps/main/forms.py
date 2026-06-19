from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from apps.main.models import Project


class ManualRiggingDesignForm(forms.Form):
    name = forms.CharField(max_length=150, required=False, label="Design name")
    lifting_points_qty = forms.ChoiceField(
        choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4')],
        initial=2,
        label="Lifting points"
    )
    shl = forms.FloatField(label="SHL (Static Hook Load)")
    ssl = forms.FloatField(label="SSL (Static Sling Load)")
    dhl = forms.FloatField(label="DHL (Dynamic Hook Load)")
    sdl = forms.FloatField(label="SDL (Dynamic Sling Load)")
    daf = forms.FloatField(label="DAF (Dynamic Amplification Factor)")
    set_active = forms.BooleanField(required=False, initial=False, label="Set as active")

    def clean(self):
        cleaned = super().clean()
        # Basic sanity checks are done by field types; ensure positive values
        for k in ('shl', 'ssl', 'dhl', 'sdl', 'daf'):
            v = cleaned.get(k)
            try:
                if v is None or float(v) <= 0:
                    self.add_error(k, "Must be a positive number")
            except (TypeError, ValueError):
                self.add_error(k, "Must be a number")
        try:
            lpq = int(cleaned.get('lifting_points_qty'))
        except (TypeError, ValueError):
            self.add_error('lifting_points_qty', 'Invalid lifting points')
            lpq = None
        if lpq is not None and (lpq < 1 or lpq > 4):
            self.add_error('lifting_points_qty', 'Must be between 1 and 4')
        return cleaned

class ProjectForm(forms.ModelForm):

    class Meta:
        model = Project
        fields = ['name', 'description']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["description"].required = False


class RegistrationForm(forms.Form):
    first_name = forms.CharField(max_length=150, label="First name")
    last_name = forms.CharField(max_length=150, label="Last name")
    email = forms.EmailField(label="Email")
    company = forms.CharField(max_length=150, label="Company", required=False)
    password1 = forms.CharField(label="Password", widget=forms.PasswordInput)
    password2 = forms.CharField(label="Confirm Password", widget=forms.PasswordInput)

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get('password1')
        p2 = cleaned.get('password2')
        if p1 and p2 and p1 != p2:
            self.add_error('password2', "Passwords do not match.")
        return cleaned


class EmailAuthenticationForm(AuthenticationForm):
    def __init__(self, request=None, *args, **kwargs):
        super().__init__(request, *args, **kwargs)
        # Rename label and use email input
        self.fields['username'].label = 'Email'
        self.fields['username'].widget = forms.EmailInput(attrs={'autofocus': True})
