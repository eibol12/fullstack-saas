* All endpoints require JWT unless AllowAny.
* All user-owner models must be filtered by request.user.
* Never accept user id from payload.
* Detail endpoints use get_object_or_404.