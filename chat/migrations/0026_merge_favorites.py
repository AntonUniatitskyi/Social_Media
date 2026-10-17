from django.db import migrations


def forwards(apps, schema_editor):
    ChatGroup = apps.get_model("chat", "ChatGroup")
    GroupMessage = apps.get_model("chat", "GroupMessage")
    Through = ChatGroup.members.through

    by_owner = {}
    for chat in ChatGroup.objects.filter(is_private=True, group_name__startswith="favorites_").order_by("id"):
        owners = list(Through.objects.filter(chatgroup_id=chat.pk).values_list("user_id", flat=True))
        if len(owners) == 1:
            by_owner.setdefault(owners[0], []).append(chat)

    for chats in by_owner.values():
        keep, *dups = chats                              # остаётся самый старый
        for dup in dups:
            GroupMessage.objects.filter(group_id=dup.pk).update(group_id=keep.pk)
            dup.delete()
        keep.is_favorites = True
        keep.group_chat_name = "Вибране"
        keep.save(update_fields=["is_favorites", "group_chat_name"])


class Migration(migrations.Migration):
    dependencies = [("chat", "0025_chatgroup_is_favorites_alter_chatgroup_group_name")]     # имя миграции из первой команды
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]