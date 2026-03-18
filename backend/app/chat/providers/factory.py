import json
from app.models import Integration
from app.chat.providers.base import ChatProvider
from app.chat.providers.openai_compat import OpenAICompatProvider


def get_provider(integration: Integration) -> ChatProvider:
    config = json.loads(integration.provider_config)

    if integration.provider_type == "openai_compatible":
        return OpenAICompatProvider(config)
    elif integration.provider_type == "ragflow":
        from app.chat.providers.ragflow import RagflowProvider
        return RagflowProvider(config)
    else:
        raise ValueError(f"Unknown provider type: {integration.provider_type}")
